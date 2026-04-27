import type { ReactNode } from "react";

type Props = {
  step: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  headerExtra?: ReactNode;
  headingTag?: "h1" | "h2";
};

export function WorkflowSection({
  step,
  title,
  subtitle,
  children,
  className = "",
  headerExtra,
  headingTag = "h2",
}: Props) {
  const id = `workflow-step-${step.replace(/\s/g, "-")}-title`;
  const Heading = headingTag;
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
            <Heading id={id} className="workflow-section__title">
              {title}
            </Heading>
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
