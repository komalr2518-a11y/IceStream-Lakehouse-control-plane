type MetricCardProps = {
  label: string;
  value: string;
  detail: string;
  tone?: 'default' | 'good' | 'danger';
  history?: number[];
};

export function MetricCard({ label, value, detail, tone = 'default', history = [] }: MetricCardProps) {
  return (
    <article className={`metric-card tone-${tone}`}>
      <div className="metric-top"><span>{label}</span><i /></div>
      <strong>{value}</strong>
      <div className="metric-foot">
        <small>{detail}</small>
        {history.length > 0 && (
          <div className="micro-bars" aria-hidden="true">
            {history.slice(-10).map((point, index) => <span key={`${point}-${index}`} style={{ height: `${Math.max(14, point)}%` }} />)}
          </div>
        )}
      </div>
    </article>
  );
}
