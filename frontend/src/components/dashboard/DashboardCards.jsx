import React from 'react';
import { Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { resolveMediaUrl } from '../../utils/mediaUrl';

const paletteClassFor = (key) => {
  if (key === 'reading' || key === 'music') return 'dark';
  if (key === 'watch') return 'brown';
  return 'paper';
};

export default function DashboardCards({ suggestionCards, handleReroll, getPlaceholderLabel }) {
  return (
    <section className="home-suggestion-grid cards-grid">
      {suggestionCards.map((group) => {
        const imageUrl = resolveMediaUrl(group.item?.image_path);
        const cardPath = group.item?.path || group.path;
        const paletteClass = paletteClassFor(group.key);

        return (
          <article
            key={group.key}
            className={`home-suggestion-card home-suggestion-card--${group.key} brutal-card ${paletteClass} ${group.item ? '' : 'is-empty'} grainy distressed`}
          >
            <button
              type="button"
              className="home-suggestion-card__dice card-pin"
              onClick={() => handleReroll(group.key, group.total)}
              disabled={group.total <= 1}
              aria-label={`Sortear outra sugestão de ${group.label}`}
            >
              <Sparkles size={14} />
            </button>

            <Link to={cardPath} className="home-suggestion-card__surface">
              <div className="home-suggestion-card__media card-media">
                {imageUrl ? (
                  <img src={imageUrl} alt={group.item?.title || group.label} />
                ) : (
                  <div className="home-suggestion-card__placeholder">{getPlaceholderLabel(group.label)}</div>
                )}
              </div>
              <div className="home-suggestion-card__overlay" />
              <div className="home-suggestion-card__content card-content">
                <span className="home-suggestion-card__label card-title">{group.item?.badge || group.label}</span>
                <strong>{group.item?.title || group.label}</strong>
                <p>{group.item?.description || group.empty}</p>
                <small>{group.item?.meta || 'Abrir módulo'}</small>
              </div>
            </Link>
          </article>
        );
      })}
    </section>
  );
}
