import type { ReactNode } from "react";

type Props = {
  step: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  headerExtra?: ReactNode;
};

export function WorkflowSection({
  step,
  title,
  subtitle,
  children,
  className = "",
  headerExtra,
}: Props) {
  const id = `workflow-step-${step.replace(/\s/g, "-")}-title`;
  return (
    <section
      className={`workflow-section ${className}`.trim()}
      aria-labelledby={id}
    >
      <div className="workflow-section__head">
        <div className="workflow-section__head-main">
          <span className="workflow-section__badge" aria-hidden>
            {step}
          </span>
          <div className="workflow-section__titles">
            <h2 id={id} className="workflow-section__title">
              {title}
            </h2>
            {subtitle ? (
              <p className="workflow-section__subtitle">{subtitle}</p>
            ) : null}
          </div>
        </div>
        {headerExtra ? (
          <div className="workflow-section__head-extra">{headerExtra}</div>
        ) : null}
      </div>
      <div className="workflow-section__body">{children}</div>
    </section>
  );
}
