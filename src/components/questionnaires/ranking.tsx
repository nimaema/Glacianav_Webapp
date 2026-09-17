"use client";
import { ReactQuestionFactory, SurveyQuestionRanking } from "survey-react-ui";
import { ArrowDown, ArrowUp, Plus, X } from "@phosphor-icons/react";

// Retain SurveyJS drag/touch/keyboard behavior and provide an explicit,
// equivalent button path. No separate answer state: both write the same model.
class AccessibleRanking extends SurveyQuestionRanking {
  protected renderElement() {
    const q = this.question;
    const ranked: string[] = q.value ?? [];
    const choices = q.visibleChoices;
    const move = (index: number, delta: number) => {
      const next = [...ranked];
      [next[index], next[index + delta]] = [next[index + delta], next[index]];
      q.value = next;
    };
    return (
      <>
        {super.renderElement()}
        {!q.isReadOnly ? (
          <details className="qn-ranking-aid">
            <summary>Rank with buttons</summary>
            <p>Choose items, then move them into your preferred order.</p>
            <ol aria-label="Your ranking">
              {ranked.map((value, index) => (
                <li key={value}>
                  <span>
                    {choices.find((c) => c.value === value)?.text ?? value}
                  </span>
                  <button
                    type="button"
                    disabled={index === 0}
                    aria-label={`Move ${choices.find((c) => c.value === value)?.text} up`}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp size={17} />
                  </button>
                  <button
                    type="button"
                    disabled={index === ranked.length - 1}
                    aria-label={`Move ${choices.find((c) => c.value === value)?.text} down`}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown size={17} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Unrank ${choices.find((c) => c.value === value)?.text}`}
                    onClick={() => {
                      q.value = ranked.filter((x) => x !== value);
                    }}
                  >
                    <X size={17} />
                  </button>
                </li>
              ))}
            </ol>
            <div>
              {choices
                .filter((c) => !ranked.includes(c.value))
                .map((c) => (
                  <button
                    type="button"
                    key={c.value}
                    disabled={
                      q.maxSelectedChoices > 0 &&
                      ranked.length >= q.maxSelectedChoices
                    }
                    onClick={() => {
                      q.value = [...ranked, c.value];
                    }}
                  >
                    <Plus size={16} />
                    Rank {c.text}
                  </button>
                ))}
            </div>
            <span role="status">{ranked.length} items ranked</span>
          </details>
        ) : null}
      </>
    );
  }
}
ReactQuestionFactory.Instance.registerQuestion("ranking", (props) => (
  <AccessibleRanking {...(props as unknown as Record<string, unknown>)} />
));
