import { useMemo, useState } from 'react'
import { Cloud, LayoutDashboard, Search, Server, Smartphone, Wrench } from 'lucide-react'
import PublicLayout from '../components/PublicLayout'
import { TECH_STACK, TECH_STACK_GROUPS } from '../data/techStack'

const GROUP_ICONS = {
  backend: Server,
  web: LayoutDashboard,
  mobile: Smartphone,
  deployment: Cloud,
  tools: Wrench,
}

const ALL_GROUPS = 'all'

function matchesQuery(item, query) {
  if (!query) return true
  const needle = query.toLowerCase()
  return item.name.toLowerCase().includes(needle) || item.definition.toLowerCase().includes(needle)
}

function TechStackPage({ onNavigate, scrollTarget, isSignedIn }) {
  const [selectedGroup, setSelectedGroup] = useState(ALL_GROUPS)
  const [query, setQuery] = useState('')
  const trimmedQuery = query.trim()

  const groupCounts = useMemo(
    () =>
      TECH_STACK_GROUPS.map((group) => ({
        ...group,
        count: TECH_STACK.filter((item) => item.group === group.id).length,
      })),
    [],
  )

  const visibleGroups = useMemo(
    () =>
      TECH_STACK_GROUPS.filter((group) => selectedGroup === ALL_GROUPS || group.id === selectedGroup)
        .map((group) => ({
          ...group,
          items: TECH_STACK.filter((item) => item.group === group.id && matchesQuery(item, trimmedQuery)),
        }))
        .filter((group) => group.items.length > 0),
    [selectedGroup, trimmedQuery],
  )

  const resultCount = visibleGroups.reduce((total, group) => total + group.items.length, 0)

  return (
    <PublicLayout currentPage="tech-stack" isSignedIn={isSignedIn} title="Tech stack" scrollTarget={scrollTarget} onNavigate={onNavigate}>
      <div className="tech-stack-content">
        <section className="tech-stack-intro" aria-labelledby="tech-stack-title">
          <p className="tech-stack-eyebrow">Technical background</p>
          <h1 id="tech-stack-title">Tech stack</h1>
          <p className="tech-stack-lead">
            The tools, frameworks, and services behind Marka&apos;s backend, web dashboard, and mobile app.
          </p>
          <ul className="tech-stack-counts" aria-label="Technologies per area">
            {groupCounts.map((group) => (
              <li key={group.id}>
                {group.count} {group.label.toLowerCase()}
              </li>
            ))}
          </ul>
        </section>

        <div className="tech-stack-controls">
          <div className="tech-stack-chips" role="group" aria-label="Filter by area">
            {[{ id: ALL_GROUPS, label: 'All' }, ...TECH_STACK_GROUPS].map((group) => (
              <button
                key={group.id}
                type="button"
                className="tech-stack-chip"
                aria-pressed={selectedGroup === group.id}
                onClick={() => setSelectedGroup(group.id)}
              >
                {group.label}
              </button>
            ))}
          </div>

          <label className="tech-stack-search">
            <Search size={17} strokeWidth={2.2} aria-hidden="true" />
            <span className="tech-stack-visually-hidden">Search technologies</span>
            <input
              type="search"
              value={query}
              placeholder="Search technologies"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>

        <p className="tech-stack-result-count" aria-live="polite">
          Showing {resultCount} {resultCount === 1 ? 'technology' : 'technologies'}
        </p>

        {visibleGroups.length === 0 ? (
          <div className="tech-stack-empty">
            <p>No match for &ldquo;{trimmedQuery}&rdquo;. Try another name.</p>
            <button type="button" className="secondary-button" onClick={() => setQuery('')}>
              Clear search
            </button>
          </div>
        ) : (
          visibleGroups.map((group) => {
            const Icon = GROUP_ICONS[group.id] ?? Wrench

            return (
              <section className="tech-stack-group" key={group.id} aria-labelledby={`tech-stack-${group.id}`}>
                <div className="tech-stack-group-heading">
                  <h2 id={`tech-stack-${group.id}`}>{group.label}</h2>
                  <span className="tech-stack-group-count">{group.items.length}</span>
                </div>
                <p className="tech-stack-group-description">{group.description}</p>

                <div className="tech-stack-grid">
                  {group.items.map((item) => (
                    <article className="tech-stack-card" key={`${group.id}-${item.name}`}>
                      <div className="tech-stack-card-top">
                        <span className="tech-stack-card-icon" aria-hidden="true">
                          <Icon size={18} strokeWidth={2.2} />
                        </span>
                        <h3>{item.name}</h3>
                      </div>
                      <p>{item.definition}</p>
                    </article>
                  ))}
                </div>
              </section>
            )
          })
        )}
      </div>
    </PublicLayout>
  )
}

export default TechStackPage
