"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { MemberGate } from "@/components/member-gate";
import { PageShell } from "@/components/page-shell";
import { StatusPill } from "@/components/status-pill";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import type {
  LearningModuleDetail,
  QuizAttemptResult,
  QuizPayload,
} from "@/lib/data";

type AnswerValue = number | number[] | null;

function answerIsComplete(answer: AnswerValue, multi?: boolean): boolean {
  if (multi) {
    return Array.isArray(answer) && answer.length > 0;
  }
  return typeof answer === "number";
}

export default function LearnQuizPage() {
  return (
    <MemberGate>
      <Suspense
        fallback={
          <PageShell>
            <p className="text-secondary">Preparing quiz…</p>
          </PageShell>
        }
      >
        <QuizBody />
      </Suspense>
    </MemberGate>
  );
}

function QuizBody() {
  const params = useParams<{ module: string }>();
  const searchParams = useSearchParams();
  const practice = searchParams.get("practice") === "1";
  const { provider, currentUser, bump } = useData();
  const [mod, setMod] = useState<LearningModuleDetail | null>(null);
  const [quiz, setQuiz] = useState<QuizPayload | null>(null);
  const [answers, setAnswers] = useState<AnswerValue[]>([]);
  const [result, setResult] = useState<QuizAttemptResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [starting, setStarting] = useState(true);

  async function beginQuiz(detail: LearningModuleDetail, userId: string) {
    if (!detail.published) {
      setError("This module is not published yet.");
      return;
    }
    if (!detail.primaryVideosWatched) {
      setError("Watch all required (primary) videos before taking the quiz.");
      return;
    }
    if (detail.attemptsRemaining === 0) {
      setError(
        "No quiz attempts left. Book time with staff for help reviewing.",
      );
      return;
    }
    const payload = await provider.startQuiz(detail.id, userId);
    setQuiz(payload);
    setAnswers(payload.questions.map((q) => (q.multi ? [] : null)));
  }

  useEffect(() => {
    if (!currentUser) return;
    void (async () => {
      setStarting(true);
      setError(null);
      try {
        const detail = await provider.getModule(params.module);
        setMod(detail);
        if (!detail) return;
        if (detail.knowledgePassed && !practice) {
          setStarting(false);
          return;
        }
        await beginQuiz(detail, currentUser.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not start quiz");
      } finally {
        setStarting(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, provider, params.module, practice]);

  async function onSubmit() {
    if (!currentUser || !quiz || !mod) return;
    if (
      quiz.questions.some(
        (q, i) => !answerIsComplete(answers[i] ?? null, q.multi),
      )
    ) {
      setError("Answer every question before submitting.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await provider.submitQuiz({
        attemptToken: quiz.attemptToken,
        userId: currentUser.id,
        moduleId: quiz.moduleId,
        questionIds: quiz.questions.map((q) => q.id),
        answers,
      });
      setResult(res);
      bump();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit quiz");
    } finally {
      setPending(false);
    }
  }

  function toggleMulti(qi: number, choiceIndex: number) {
    setAnswers((prev) => {
      const next = [...prev];
      const current = Array.isArray(next[qi]) ? [...(next[qi] as number[])] : [];
      const idx = current.indexOf(choiceIndex);
      if (idx >= 0) current.splice(idx, 1);
      else current.push(choiceIndex);
      current.sort((a, b) => a - b);
      next[qi] = current;
      return next;
    });
  }

  if (starting) {
    return (
      <PageShell>
        <p className="text-secondary">Preparing quiz…</p>
      </PageShell>
    );
  }

  if (!mod) {
    return (
      <PageShell>
        <h1 className="font-display text-2xl font-semibold text-brown">
          Module not found
        </h1>
        <Link href="/learn" className="mt-4 inline-block text-primary-text">
          ← Learn
        </Link>
      </PageShell>
    );
  }

  if (mod.knowledgePassed && !practice && !result) {
    return (
      <PageShell>
        <StatusPill tone="ok">
          {mod.knowledgeOnly
            ? "Knowledge certified"
            : "Knowledge test passed"}
        </StatusPill>
        <h1 className="mt-4 font-display text-3xl font-semibold text-brown">
          {mod.title}
        </h1>
        <p className="mt-3 max-w-xl text-secondary leading-relaxed">
          {mod.knowledgeOnly
            ? "You’ve already passed the knowledge quiz for this knowledge-only module."
            : "You’ve already passed the knowledge quiz for this module. Staff and tool champions can see you in the checkoff queue."}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild variant="secondary">
            <Link href={`/learn/${mod.slug}`}>Back to module</Link>
          </Button>
          {mod.attemptsRemaining > 0 ? (
            <Button asChild variant="outline">
              <Link href={`/learn/${mod.slug}/quiz?practice=1`}>
                Practice quiz
              </Link>
            </Button>
          ) : null}
          <Button asChild>
            <Link href="/learn">View Learn status</Link>
          </Button>
        </div>
      </PageShell>
    );
  }

  if (result) {
    const score = result.scorePct ?? result.scorePercent;
    return (
      <PageShell>
        <StatusPill tone={result.passed ? "ok" : "warn"}>
          {result.passed ? "Passed" : "Not passed"}
        </StatusPill>
        <h1 className="mt-4 font-display text-3xl font-semibold text-brown">
          Score: {score}%
        </h1>
        <ul className="mt-4 space-y-2 text-sm text-secondary">
          <li>
            Threshold{" "}
            {result.thresholdMet ? "met" : "not met"} (need{" "}
            {quiz?.passThresholdPercent ?? mod.passThresholdPercent}%).
          </li>
          <li>
            Attempts remaining: {result.attemptsRemaining}
          </li>
        </ul>

        {result.safetyCriticalMissed.length > 0 ? (
          <div className="mt-6 max-w-xl rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3">
            <p className="font-display text-sm font-semibold text-brown">
              Safety-critical misses
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-secondary">
              {result.safetyCriticalMissed.map((q) => (
                <li key={q.id}>{q.prompt}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="mt-6 max-w-xl text-secondary leading-relaxed">
          {result.passed
            ? result.knowledgePassed
              ? mod.knowledgeOnly
                ? "Knowledge recorded — you’re certified for this knowledge-only module."
                : "Knowledge test passed. Staff and tool champions now see you in the checkoff queue for a hands-on session. This does not grant machine access by itself — track status under Learn."
              : "Passed, but certification status did not update — contact staff."
            : result.attemptsRemaining === 0
              ? "No attempts left. Contact staff to review and continue."
              : "Review the lessons and required videos, then try again."}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild>
            <Link href={`/learn/${mod.slug}`}>Back to module</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/learn">View Learn status</Link>
          </Button>
          {!result.passed && result.attemptsRemaining > 0 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setResult(null);
                setQuiz(null);
                setAnswers([]);
                setStarting(true);
                setError(null);
                void (async () => {
                  if (!currentUser) return;
                  try {
                    const detail = await provider.getModule(params.module);
                    if (detail) {
                      setMod(detail);
                      await beginQuiz(detail, currentUser.id);
                    }
                  } catch (err) {
                    setError(
                      err instanceof Error
                        ? err.message
                        : "Could not restart quiz",
                    );
                  } finally {
                    setStarting(false);
                  }
                })();
              }}
            >
              Try again
            </Button>
          ) : null}
        </div>
      </PageShell>
    );
  }

  if (error && !quiz) {
    return (
      <PageShell>
        <h1 className="mt-2 font-display text-2xl font-semibold text-brown">
          Quiz unavailable
        </h1>
        <p className="mt-3 text-accent" role="alert">
          {error}
        </p>
        <Button asChild className="mt-8" variant="secondary">
          <Link href={`/learn/${mod.slug}`}>Back to module</Link>
        </Button>
      </PageShell>
    );
  }

  if (!quiz) return null;

  return (
    <PageShell>
      <Link
        href={`/learn/${mod.slug}`}
        className="font-display text-sm text-primary-text hover:underline"
      >
        ← {mod.title}
      </Link>
      {practice ? (
        <div className="mt-4 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-brown">
          Practice mode — you’re already certified for this module. Taking the
          quiz again is optional review (still uses an attempt).
        </div>
      ) : null}
      <p className="eyebrow mt-6">Knowledge quiz</p>
      <h1 className="mt-3 font-display text-3xl font-semibold text-brown">
        {mod.title}
      </h1>
      <p className="mt-2 text-secondary">
        Attempt {quiz.attemptNumber} of {quiz.attemptLimit} · Pass at{" "}
        {quiz.passThresholdPercent}% · {quiz.questions.length} questions
      </p>
      <p className="mt-2 max-w-xl text-sm text-secondary">
        Passing records knowledge only — it does not grant machine access
        unless this is a knowledge-only module.
      </p>

      <ol className="mt-10 space-y-8">
        {quiz.questions.map((q, qi) => (
          <li key={q.id} className="max-w-2xl">
            <p className="font-display font-semibold text-brown">
              {qi + 1}. {q.prompt}
            </p>
            {q.multi ? (
              <p className="mt-1 text-xs uppercase tracking-wider text-secondary">
                Select all that apply
              </p>
            ) : null}
            <ul className="mt-3 space-y-2">
              {q.choices.map((choice, ci) => {
                const selected = q.multi
                  ? Array.isArray(answers[qi]) &&
                    (answers[qi] as number[]).includes(ci)
                  : answers[qi] === ci;
                return (
                  <li key={ci}>
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface/80 px-4 py-3 hover:border-primary/40">
                      <input
                        type={q.multi ? "checkbox" : "radio"}
                        className="mt-1 accent-[var(--color-button)]"
                        name={`q-${q.id}`}
                        checked={selected}
                        onChange={() => {
                          if (q.multi) {
                            toggleMulti(qi, ci);
                          } else {
                            setAnswers((prev) => {
                              const next = [...prev];
                              next[qi] = ci;
                              return next;
                            });
                          }
                        }}
                      />
                      <span className="text-charcoal">{choice}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>

      {error ? (
        <p className="mt-6 text-sm text-accent" role="alert">
          {error}
        </p>
      ) : null}

      <Button
        type="button"
        className="mt-8"
        disabled={pending}
        onClick={() => void onSubmit()}
      >
        {pending ? "Submitting…" : "Submit quiz"}
      </Button>
    </PageShell>
  );
}
