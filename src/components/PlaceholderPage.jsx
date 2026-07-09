function PlaceholderPage({ tag, title, description, metrics = [], panels = [] }) {
  return (
    <div className="content-stack">
      <section className="hero-panel">
        <p className="section-tag">{tag}</p>
        <h2>{title}</h2>
        <p className="supporting-text">{description}</p>
      </section>

      {metrics.length ? (
        <section className="stat-grid">
          {metrics.map((metric) => (
            <article className="stat-card" key={metric.label}>
              <p>{metric.label}</p>
              <strong>{metric.value}</strong>
              <span>{metric.note}</span>
            </article>
          ))}
        </section>
      ) : null}

      <section className="panel-grid">
        {panels.map((panel) => (
          <article className="content-card" key={panel.title}>
            <p className="content-card-tag">{panel.tag}</p>
            <h3>{panel.title}</h3>
            <p>{panel.description}</p>
          </article>
        ))}
      </section>
    </div>
  )
}

export default PlaceholderPage
