import { ETAPES_PIPELINE, indexEtape, estStatutTerminalNegatif, STATUTS_TERMINAUX, LIBELLES_STATUT } from '../constants/statuts';
import './Pipeline.css';

// Représente la progression d'une demande sous forme de conduite segmentée.
// Chaque segment = une étape du workflow réel ; l'eau "remplit" les segments franchis.
export default function Pipeline({ statutActuel, compact = false, showLegend = false }) {
  if (estStatutTerminalNegatif(statutActuel)) {
    const info = STATUTS_TERMINAUX[statutActuel];
    return (
      <div
        className={`pipeline pipeline-arret pipeline-${info.couleur}`}
        role="status"
        aria-label={`Demande ${info.libelle.toLowerCase()}`}
      >
        <span className="pipeline-arret-icone" aria-hidden="true">⊘</span>
        <span>{info.libelle}</span>
      </div>
    );
  }

  const idxActuel = indexEtape(statutActuel);
  const etapeCourante = ETAPES_PIPELINE[idxActuel];
  const libelleCourant = etapeCourante?.libelle || 'Statut inconnu';
  const totalEtapes = ETAPES_PIPELINE.length;
  const progression = idxActuel >= 0 ? Math.round(((idxActuel + 1) / totalEtapes) * 100) : 0;

  return (
    <div className={`pipeline-wrap ${compact ? 'pipeline-wrap-compact' : ''}`}>
      <div
        className={`pipeline ${compact ? 'pipeline-compact' : ''}`}
        role="list"
        aria-label={`Progression du dossier : étape ${idxActuel + 1} sur ${totalEtapes}, ${libelleCourant}`}
      >
        {ETAPES_PIPELINE.map((etape, i) => {
          const franchi = i < idxActuel;
          const encours = i === idxActuel;
          const etat = franchi ? 'terminée' : encours ? 'en cours' : 'à venir';
          return (
            <div
              key={etape.code}
              className="pipeline-segment-groupe"
              role="listitem"
              aria-current={encours ? 'step' : undefined}
              aria-label={`${etape.libelle} : ${etat}`}
            >
              <div
                className={`pipeline-segment ${franchi ? 'rempli' : ''} ${encours ? 'encours' : ''}`}
                title={etape.libelle}
              >
                {encours && <span className="pipeline-flux" aria-hidden="true" />}
                {!compact && (
                  <span className="pipeline-etape-num" aria-hidden="true">{i + 1}</span>
                )}
              </div>
              {!compact && (
                <span
                  className={`pipeline-label ${encours ? 'encours' : ''} ${franchi ? 'rempli' : ''}`}
                  title={etape.libelle}
                >
                  {etape.abrev}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Barre de progression accessible (lecteurs d'écran) */}
      <div
        className="pipeline-progression-sr"
        role="progressbar"
        aria-valuenow={progression}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Avancement : ${progression} %, ${libelleCourant}`}
      />

      {showLegend && !compact && etapeCourante && (
        <div className="pipeline-legende" aria-live="polite">
          <span className="pipeline-legende-etape">
            Étape {idxActuel + 1}/{totalEtapes}
          </span>
          <span className="pipeline-legende-libelle">{libelleCourant}</span>
        </div>
      )}
    </div>
  );
}

/** Libellé textuel de l'étape courante — utile hors du composant Pipeline */
export function libelleEtapeCourante(statut) {
  if (estStatutTerminalNegatif(statut)) return STATUTS_TERMINAUX[statut].libelle;
  return LIBELLES_STATUT[statut] || statut;
}
