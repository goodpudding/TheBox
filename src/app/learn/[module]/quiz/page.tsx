"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
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

export default function LearnQuizPage() {
  return (
    <MemberGate>
      <QuizBody />
    </MemberGate>
  );
}

function QuizBody() {
  const params = useParams<{ module: string }>();
  const { provider, currentUser, bump } = useData();
  const [mod, setMod] = useState<LearningModuleDetail | null>(null);
  const [quiz, setQuiz] = useState<QuizPayload | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [result, setResult] = useState<QuizAttemptResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    void (async () => {
      setStarting(true);
      setError(null);
      try {
        const detail = await provider.getModule(params.module);
        setMod(detail);
        if (!detail) return;
        if (detail.knowledgePassed) {
          setStarting(false);
          return;
        }
        const allDone =
          detail.lessons.length > 0 &&
          detail.lessons.every((l) => l.completed);
        if (!allDone) {
          setError("Finish every lesson before taking the quiz.");
          setStarting(false);
          return;
        }
        const payload = await provider.startQuiz(detail.id, currentUser.id);
        setQuiz(payload);
        setAnswers(payload.questions.map(() => null));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not start quiz");
      } finally {
        setStarting(false);
      }
    })();
  }, [currentUser, provider, params.module]);

  async function onSubmit() {
    if (!currentUser || !quiz || !mod) return;
    if (answers.some((a) => a == null)) {
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

  if (mod.knowledgePassed && !result) {
    return (
      <PageShell>
        <StatusPill tone="ok">Already passed</StatusPill>
        <h1 className="mt-4 font-display text-3xl font-semibold text-brown">
          {mod.title}
        </h1>
        <p className="mt-3 text-secondary">
          You’ve already passed the knowledge quiz for this module.
        </p>
        <Button asChild className="mt-8" variant="secondary">
          <Link href={`/learn/${mod.slug}`}>Back to module</Link>
        </Button>
      </PageShell>
    );
  }

  if (result) {
    return (
      <PageShell>
        <StatusPill tone={result.passed ? "ok" : "warn"}>
          {result.passed ? "Passed" : "Not passed"}
        </StatusPill>
        <h1 className="mt-4 font-display text-3xl font-semibold text-brown">
          Score: {result.scorePercent}%
        </h1>
        <p className="mt-3 max-w-xl text-secondary leading-relaxed">
          {result.passed
            ? result.knowledgePassed
              ? mod.knowledgeOnly
                ? "Knowledge recorded — you’re certified for this knowledge-only module."
                : "Knowledge recorded. Book a hands-on checkoff so staff can certify you for machine use."
              : "Passed, but certification status did not update — contact staff."
            : `Need ${quiz?.passThresholdPercent ?? mod.passThresholdPercent}% to pass. Review the lessons and try again if you have attempts left.`}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild>
            <Link href={`/learn/${mod.slug}`}>Back to module</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/certifications">View certifications</Link>
          </Button>
          {!result.passed ? (
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
                    const payload = await provider.startQuiz(
                      mod.id,
                      currentUser.id,
                    );
                    setQuiz(payload);
                    setAnswers(payload.questions.map(() => null));
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
      <p className="eyebrow mt-6">Knowledge quiz</p>
      <h1 className="mt-3 font-display text-3xl font-semibold text-brown">
        {mod.title}
      </h1>
      <p className="mt-2 text-secondary">
        Attempt {quiz.attemptNumber} of {quiz.attemptLimit} · Pass at{" "}
        {quiz.passThresholdPercent}% · {quiz.questions.length} questions
      </p>

      <ol className="mt-10 space-y-8">
        {quiz.questions.map((q, qi) => (
          <li key={q.id} className="max-w-2xl">
            <p className="font-display font-semibold text-brown">
              {qi + 1}. {q.prompt}
            </p>
            <ul className="mt-3 space-y-2">
              {q.choices.map((choice, ci) => (
                <li key={ci}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface/80 px-4 py-3 hover:border-primary/40">
                    <input
                      type="radio"
                      className="mt-1 accent-[var(--color-button)]"
                      name={`q-${q.id}`}
                      checked={answers[qi] === ci}
                      onChange={() => {
                        setAnswers((prev) => {
                          const next = [...prev];
                          next[qi] = ci;
                          return next;
                        });
                      }}
                    />
                    <span className="text-charcoal">{choice}</span>
                  </label>
                </li>
              ))}
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
