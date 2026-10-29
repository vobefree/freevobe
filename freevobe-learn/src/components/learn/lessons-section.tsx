'use client';

import { useMemo, useState } from 'react';
import { compileWorld } from '@/lib/learn/compile';
import { LESSONS } from '@/lib/learn/lessons';
import type { LearnProgress } from '@/lib/learn/progress';
import type { PlayableWorld } from '@/lib/learn/types';

export interface LessonsSectionProps {
  world: PlayableWorld | null;
  progress: LearnProgress;
  onLessonDone: (lessonId: string) => void;
}

export function LessonsSection({ world, progress, onLessonDone }: LessonsSectionProps) {
  const [answers, setAnswers] = useState<Record<string, { choice: number; correct: boolean }>>({});

  // Innan barnet har byggt en värld används en liten exempelvärld, så att lektionerna går att
  // läsa i vilken ordning som helst.
  const exampleWorld = useMemo<PlayableWorld | null>(() => {
    if (world) return world;
    const result = compileWorld('En skog med en katt och tre stjärnor');
    return result.ok ? result.world : null;
  }, [world]);

  const done = progress.lessonsDone.filter((id) => LESSONS.some((lesson) => lesson.id === id)).length;

  return (
    <section id="lektioner" className="scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] tracking-[0.08em] text-[color:var(--learn-muted)]">
            Lektioner
          </p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Läs koden bakom din värld
          </h2>
          <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-[color:var(--learn-muted)]">
            {LESSONS.length} korta lektioner med kod som finns i appen du just använde – inte
            påhittade exempel. Varje lektion visar din egen värld bredvid koden.
          </p>
        </div>
        <p className="learn-tile px-3 py-2 text-[12.5px] font-semibold" data-testid="learn-lesson-progress">
          {done} av {LESSONS.length} klara
        </p>
      </div>

      <ol className="mt-6 space-y-3">
        {LESSONS.map((lesson, index) => {
          const isDone = progress.lessonsDone.includes(lesson.id);
          const answer = answers[lesson.id];
          const example = exampleWorld ? lesson.example(exampleWorld) : [];

          return (
            <li key={lesson.id}>
              <details
                className="learn-panel-flat overflow-hidden"
                data-testid={`learn-lesson-${lesson.id}`}
              >
                <summary className="flex cursor-pointer flex-wrap items-center gap-3 px-4 py-3.5">
                  <span className="font-mono text-[12px] text-[color:var(--learn-gold)]">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="text-[15px] font-bold">{lesson.title}</span>
                  {isDone ? (
                    <span className="ml-auto rounded-full border border-[color:var(--learn-mint)]/50 px-2 py-0.5 text-[11px] font-semibold text-[color:var(--learn-mint)]">
                      Klar
                    </span>
                  ) : null}
                </summary>

                <div className="border-t border-[color:var(--learn-line)] px-4 py-4">
                  <p className="text-[14px] leading-relaxed">{lesson.idea}</p>

                  <div className="mt-3">
                    <p className="font-mono text-[10.5px] tracking-[0.06em] text-[color:var(--learn-muted)]">
                      {lesson.source.file} → {lesson.source.symbol}()
                    </p>
                    <pre className="learn-code mt-1.5">
                      <code>{lesson.code}</code>
                    </pre>
                  </div>

                  <ul className="mt-3 space-y-1.5 text-[13px] leading-relaxed">
                    {lesson.points.map((point) => (
                      <li key={point} className="flex gap-2">
                        <span aria-hidden="true" className="text-[color:var(--learn-gold)]">
                          —
                        </span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>

                  {example.length > 0 ? (
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {example.map((row) => (
                        <div key={row.label} className="learn-tile px-2.5 py-2">
                          <p className="font-mono text-[10px] tracking-[0.05em] text-[color:var(--learn-muted)]">
                            {row.label}
                          </p>
                          <p className="mt-0.5 text-[12.5px] font-semibold break-words">{row.value}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-4 rounded-xl border border-[color:var(--learn-line)] bg-[color:var(--learn-panel-strong)] p-3">
                    <p className="text-[13.5px] font-semibold">{lesson.quiz.question}</p>
                    <div className="mt-2 flex flex-col gap-1.5">
                      {lesson.quiz.options.map((option, optionIndex) => {
                        const revealed = answer !== undefined;
                        const isChosen = answer?.choice === optionIndex;
                        const isRight = optionIndex === lesson.quiz.answer;
                        const showRight = revealed && isRight;
                        const showWrong = revealed && isChosen && !isRight;

                        return (
                          <button
                            key={option}
                            type="button"
                            disabled={revealed}
                            onClick={() => {
                              const correct = optionIndex === lesson.quiz.answer;
                              setAnswers((current) => ({
                                ...current,
                                [lesson.id]: { choice: optionIndex, correct },
                              }));
                              if (correct) onLessonDone(lesson.id);
                            }}
                            className="rounded-lg border px-3 py-2 text-left text-[13px] transition-colors disabled:cursor-default"
                            style={{
                              borderColor: showRight
                                ? 'var(--learn-mint)'
                                : showWrong
                                  ? 'var(--learn-coral)'
                                  : 'var(--learn-line)',
                              background: showRight
                                ? 'color-mix(in srgb, var(--learn-mint) 12%, transparent)'
                                : showWrong
                                  ? 'color-mix(in srgb, var(--learn-coral) 12%, transparent)'
                                  : 'transparent',
                            }}
                          >
                            {option}
                            {showRight ? ' ✓' : ''}
                            {showWrong ? ' ✕' : ''}
                          </button>
                        );
                      })}
                    </div>
                    {answer ? (
                      <p className="mt-2 text-[12.5px] leading-relaxed text-[color:var(--learn-muted)]">
                        {answer.correct
                          ? lesson.quiz.explanation
                          : `Inte riktigt. ${lesson.quiz.explanation}`}
                      </p>
                    ) : null}
                  </div>
                </div>
              </details>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
