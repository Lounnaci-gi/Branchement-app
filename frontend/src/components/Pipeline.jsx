import { ETAPES_PIPELINE, indexEtape, estStatutTerminalNegatif, STATUTS_TERMINAUX } from '../constants/statuts';
import './Pipeline.css';

// Représente la progression d'une demande sous forme de conduite segmentée.
// Chaque segment = une étape du workflow réel ; l'eau "remplit" les segments franchis.
export default function Pipeline({ statutActuel, compact = false }) {
  if (estStatutTerminalNegatif(statutActuel)) {
    const info = STATUTS_TERMINAUX[statutActuel];
    return (
      <div className={`pipeline pipeline-arret pipeline-${info.couleur}`} role="status" aria-label={`Demande ${info.libelle.toLowerCase()}`}>
        <span className="pipeline-arret-icone">⊘</span>
        <span>{info.libelle}</span>
      </div>
    );
  }

  const idxActuel = indexEtape(statutActuel);

  return (
    <div className={`pipeline ${compact ? 'pipeline-compact' : ''}`} role="list" aria-label={`Progression : ${ETAPES_PIPELINE[idxActuel]?.libelle || 'statut inconnu'}`}>
      {ETAPES_PIPELINE.map((etape, i) => {
        const franchi = i < idxActuel;
        const encours = i === idxActuel;
        return (
          <div key={etape.code} className="pipeline-segment-groupe" role="listitem" aria-label={`${etape.libelle} : ${franchi ? 'terminée' : encours ? 'en cours' : 'à venir'}`}>
            <div
              className={`pipeline-segment ${franchi ? 'rempli' : ''} ${encours ? 'encours' : ''}`}
              title={etape.libelle}
            >
              {encours && <span className="pipeline-flux" />}
            </div>
            {!compact && (
              <span className={`pipeline-label ${encours ? 'encours' : ''} ${franchi ? 'rempli' : ''}`}>
                {etape.abrev}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
