/**
 * Minimal Google Drive v3 REST client (read-only) over `fetch`.
 * Covers exactly what the CMS sync needs: list a folder, export a Doc/Sheet,
 * download a binary file. Works for My Drive and shared drives.
 */
import type { ServiceAccountTokenSource } from "./auth";

const DRIVE_API = "https://www.googleapis.com/drive/v3";

export const MIME = {
  folder: "application/vnd.google-apps.folder",
  doc: "application/vnd.google-apps.document",
  sheet: "application/vnd.google-apps.spreadsheet",
  slides: "application/vnd.google-apps.presentation",
  shortcut: "application/vnd.google-apps.shortcut",
} as const;

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  /** Present for binary (non-Google-native) files only. */
  md5Checksum?: string;
  size?: string;
  /** Drive's own monotonically increasing revision counter. */
  version?: string;
  description?: string;
  webViewLink?: string;
  shortcutDetails?: { targetId?: string; targetMimeType?: string };
}

const FILE_FIELDS =
  "id,name,mimeType,modifiedTime,md5Checksum,size,version,description,webViewLink,shortcutDetails";

export class DriveClient {
  constructor(
    private readonly tokens: ServiceAccountTokenSource,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async request(
    path: string,
    params: Record<string, string> = {},
  ): Promise<Response> {
    const url = new URL(`${DRIVE_API}${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    url.searchParams.set("supportsAllDrives", "true");
    const token = await this.tokens.getToken();
    const res = await this.fetchImpl(url, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Drive API ${path} failed (${res.status}): ${text.slice(0, 300)}`,
      );
    }
    return res;
  }

  async getFile(fileId: string): Promise<DriveFile> {
    const res = await this.request(`/files/${encodeURIComponent(fileId)}`, {
      fields: FILE_FIELDS,
    });
    return (await res.json()) as DriveFile;
  }

  /** All non-trashed children of a folder (follows pagination; resolves shortcuts). */
  async listChildren(folderId: string): Promise<DriveFile[]> {
    const files: DriveFile[] = [];
    let pageToken: string | undefined;
    do {
      const params: Record<string, string> = {
        q: `'${folderId.replace(/'/g, "\\'")}' in parents and trashed = false`,
        fields: `nextPageToken,files(${FILE_FIELDS})`,
        pageSize: "200",
        includeItemsFromAllDrives: "true",
        orderBy: "name",
      };
      if (pageToken) params.pageToken = pageToken;
      const res = await this.request("/files", params);
      const json = (await res.json()) as {
        nextPageToken?: string;
        files: DriveFile[];
      };
      files.push(...json.files);
      pageToken = json.nextPageToken;
    } while (pageToken);

    return Promise.all(
      files.map(async (f) => {
        if (f.mimeType !== MIME.shortcut || !f.shortcutDetails?.targetId) {
          return f;
        }
        // A shortcut to a Doc/folder elsewhere in Drive behaves like the target.
        const target = await this.getFile(f.shortcutDetails.targetId);
        return { ...target, name: f.name };
      }),
    );
  }

  /** Find a direct child folder by name (case-insensitive). */
  async findChildFolder(
    parentId: string,
    name: string,
  ): Promise<DriveFile | null> {
    const children = await this.listChildren(parentId);
    const wanted = name.trim().toLowerCase();
    return (
      children.find(
        (c) => c.mimeType === MIME.folder && c.name.trim().toLowerCase() === wanted,
      ) ?? null
    );
  }

  /** Resolve a slash-separated path like "Photos/Made here" under a root folder. */
  async resolveFolderPath(
    rootId: string,
    path: string,
  ): Promise<DriveFile | null> {
    let current: DriveFile | null = { id: rootId, name: "", mimeType: MIME.folder };
    for (const segment of path.split("/").filter(Boolean)) {
      if (!current) return null;
      current = await this.findChildFolder(current.id, segment);
    }
    return current;
  }

  /** Export a Google-native file (Doc → text/html, Sheet → text/csv, Slides → application/pdf). */
  async exportFile(fileId: string, mimeType: string): Promise<Buffer> {
    const res = await this.request(
      `/files/${encodeURIComponent(fileId)}/export`,
      { mimeType },
    );
    return Buffer.from(await res.arrayBuffer());
  }

  async exportDocHtml(fileId: string): Promise<string> {
    return (await this.exportFile(fileId, "text/html")).toString("utf8");
  }

  async exportSheetCsv(fileId: string): Promise<string> {
    return (await this.exportFile(fileId, "text/csv")).toString("utf8");
  }

  /** Download the bytes of a binary (uploaded) file such as a PNG, JPG, or PDF. */
  async downloadFile(fileId: string): Promise<Buffer> {
    const res = await this.request(`/files/${encodeURIComponent(fileId)}`, {
      alt: "media",
    });
    return Buffer.from(await res.arrayBuffer());
  }
}

export function isGoogleNative(file: Pick<DriveFile, "mimeType">): boolean {
  return file.mimeType.startsWith("application/vnd.google-apps.");
}
