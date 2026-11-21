"use client";

import { useState, type FormEvent } from "react";
import { useData } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Question, QuestionSource } from "@/lib/data";

const MIN_CHOICES = 2;
const MAX_CHOICES = 6;

const selectClass =
  "flex h-11 w-full rounded-full border border-border bg-surface px-4 font-display text-sm text-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

/** The answers a question counts as right: the list, or the single one. */
export function rightAnswers(q: Pick<Question, "correctIndex" | "correctIndexes">): number[] {
  return q.correctIndexes && q.correctIndexes.length > 0
    ? [...q.correctIndexes].sort((a, b) => a - b)
    : [q.correctIndex];
}

/**
 * One quiz question: the wording, two to six choices, and a tick beside
 * every choice that is right. More than one tick makes it a "choose all that
 * apply" question. Used to add a question and to change one.
 */
export function QuestionForm({
  moduleId,
  question,
  onSaved,
  onCancel,
  onRemove,
}: {
  moduleId: string;
  question?: Question;
  onSaved: (message: string) => void;
  onCancel?: () => void;
  onRemove?: () => void;
}) {
  const { provider } = useData();
  const prefix = question ? `q-${question.id}` : "q-new";
  const [prompt, setPrompt] = useState(question?.prompt ?? "");
  const [choices, setChoices] = useState<string[]>(
    question ? [...question.choices] : ["", "", "", ""],
  );
  const [right, setRight] = useState<number[]>(question ? rightAnswers(question) : []);
  const [explanation, setExplanation] = useState(question?.explanation ?? "");
  const [source, setSource] = useState<QuestionSource>(question?.source ?? "video");
  const [safetyCritical, setSafetyCritical] = useState(question?.safetyCritical ?? false);
  const [answerPending, setAnswerPending] = useState(question?.answerPending ?? false);
  const [verifyAgainstVideo, setVerifyAgainstVideo] = useState(
    question?.verifyAgainstVideo ?? true,
  );
  const [active, setActive] = useState(question?.active ?? true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleRight(index: number) {
    setRight((list) =>
      list.includes(index)
        ? list.filter((i) => i !== index)
        : [...list, index].sort((a, b) => a - b),
    );
  }

  function removeChoice(index: number) {
    setChoices((list) => list.filter((_, i) => i !== index));
    // The ticks follow their choices: the removed one goes, later ones move up.
    setRight((list) =>
      list.filter((i) => i !== index).map((i) => (i > index ? i - 1 : i)),
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (right.length === 0) {
      setError("Tick at least one right answer.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await provider.adminUpsertQuestion({
        id: question?.id,
        moduleId,
        prompt,
        choices,
        correctIndex: right[0]!,
        correctIndexes: right,
        explanation,
        source,
        safetyCritical,
        answerPending,
        verifyAgainstVideo,
        active,
      });
      if (!question) {
        setPrompt("");
        setChoices(["", "", "", ""]);
        setRight([]);
        setExplanation("");
        setSafetyCritical(false);
        setAnswerPending(false);
      }
      onSaved(question ? "Question saved." : "Question added.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the question.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      className="mt-4 max-w-xl space-y-4 rounded-2xl border border-border bg-surface/60 p-4"
    >
      {question ? null : (
        <h3 className="font-display text-lg font-semibold text-brown">
          Add a question
        </h3>
      )}
      <div className="space-y-2">
        <Label htmlFor={`${prefix}-prompt`}>Question</Label>
        <Textarea
          id={`${prefix}-prompt`}
          rows={2}
          className="min-h-[5rem]"
          required
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
      </div>

      <fieldset className="space-y-3">
        <legend className="font-display text-sm font-medium text-brown">
          Choices
        </legend>
        <p className="text-sm text-secondary">
          Tick every choice that is right. With more than one ticked, members
          must pick all of them to get the question.
        </p>
        {choices.map((choice, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="checkbox"
              className="size-5 shrink-0"
              checked={right.includes(i)}
              onChange={() => toggleRight(i)}
              aria-label={`Choice ${i + 1} is a right answer`}
            />
            <Input
              aria-label={`Choice ${i + 1}`}
              required
              value={choice}
              onChange={(e) =>
                setChoices((list) =>
                  list.map((c, at) => (at === i ? e.target.value : c)),
                )
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={choices.length <= MIN_CHOICES}
              onClick={() => removeChoice(i)}
              aria-label={`Remove choice ${i + 1}`}
            >
              Remove
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={choices.length >= MAX_CHOICES}
          onClick={() => setChoices((list) => [...list, ""])}
        >
          Add a choice
        </Button>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor={`${prefix}-explanation`}>
          Explanation (shown after the quiz)
        </Label>
        <Textarea
          id={`${prefix}-explanation`}
          rows={2}
          className="min-h-[5rem]"
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}-source`}>Where the answer comes from</Label>
        <select
          id={`${prefix}-source`}
          value={source}
          onChange={(e) => setSource(e.target.value as QuestionSource)}
          className={selectClass}
        >
          <option value="video">A lesson video</option>
          <option value="shop-policy">Shop policy</option>
        </select>
      </div>
      <label className="flex items-center gap-3 text-charcoal">
        <input
          type="checkbox"
          className="size-5"
          checked={safetyCritical}
          onChange={(e) => setSafetyCritical(e.target.checked)}
        />
        Safety-critical (a member who misses it does not pass)
      </label>
      <label className="flex items-center gap-3 text-charcoal">
        <input
          type="checkbox"
          className="size-5"
          checked={answerPending}
          onChange={(e) => setAnswerPending(e.target.checked)}
        />
        The answer is not settled yet (blocks publishing)
      </label>
      {question ? (
        <>
          <label className="flex items-center gap-3 text-charcoal">
            <input
              type="checkbox"
              className="size-5"
              checked={verifyAgainstVideo}
              onChange={(e) => setVerifyAgainstVideo(e.target.checked)}
            />
            Check the answer against the video
          </label>
          <label className="flex items-center gap-3 text-charcoal">
            <input
              type="checkbox"
              className="size-5"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            In use (unticked, it is kept but never asked)
          </label>
        </>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-2xl border border-accent/40 bg-accent/15 px-4 py-3 text-brown"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending} size="sm">
          {pending ? "Saving…" : question ? "Save question" : "Add question"}
        </Button>
        {onCancel ? (
          <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        {onRemove ? (
          <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
            Remove question
          </Button>
        ) : null}
      </div>
    </form>
  );
}
