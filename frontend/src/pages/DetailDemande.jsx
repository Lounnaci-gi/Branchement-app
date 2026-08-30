import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import client from '../api/client';
import Pipeline from '../components/Pipeline';
import StatutBadge from '../components/StatutBadge';
import Breadcrumbs from '../components/Breadcrumbs';
import { LIBELLES_STATUT } from '../constants/statuts';
import PanneauEtude from '../components/panneaux/PanneauEtude';
import PanneauDevis from '../components/panneaux/PanneauDevis';
import PanneauTravaux from '../components/panneaux/PanneauTravaux';
import PanneauMiseEnService from '../components/panneaux/PanneauMiseEnService';
import { imprimerAccuse } from '../utils/impressionAccuse';
import { imprimerDemande } from '../utils/impressionDemande';
import { imprimerDevis } from '../utils/impressionDevis';
import { imprimerOrdreExecution } from '../utils/impressionOrdreExecution';
import { notifierErreur, notifierSucces } from '../utils/notifications';

function nettoyerTexte(valeur, defaut = '') {
  const texte = String(valeur ?? '').replace(/[<>"']/g, '').replace(/\s{2,}/g, ' ').trim();
  return texte || defaut;
}

const MOTIFS_REJET_RAPIDES = [
  'Dossier incomplet (pièces d’identité ou justificatifs manquants)',
  'Réseau AEP non disponible à l’adresse indiquée',
  'Non-conformité technique des installations intérieures',
  'Annulation à la demande explicite de l’usager'
];

export default function DetailDemande() {
  const { id } = useParams();
  const [fiche, setFiche] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [commentaire, setCommentaire] = useState('');
  const [enTransition, setEnTransition] = useState(false);
  const [copieChamp, setCopieChamp] = useState(null);

  const recharger = useCallback(() => {
    client.get(`/demandes/${id}`).then((res) => setFiche(res.data)).finally(() => setChargement(false));
  }, [id]);

  useEffect(() => { recharger(); }, [recharger]);

  async function changerStatut(nouveauStatut) {
    setEnTransition(true);
    try {
      await client.patch(`/demandes/${id}/statut`, { nouveau_statut: nouveauStatut, commentaire: commentaire || null });
      setCommentaire('');
      notifierSucces(`Statut mis à jour : ${LIBELLES_STATUT[nouveauStatut] || nouveauStatut}`);
      recharger();
    } catch (err) {
      notifierErreur(nettoyerTexte(err.response?.data?.erreur || 'Erreur lors du changement de statut.'));
    } finally {
      setEnTransition(false);
    }
  }

  function copier(texte, label) {
    if (!texte) return;
    navigator.clipboard.writeText(String(texte).trim()).then(() => {
      setCopieChamp(label);
      setTimeout(() => setCopieChamp(null), 2000);
    });
  }

  function defilerVers(panneauId) {
    const el = document.getElementById(panneauId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  if (chargement) {
    return (
      <div className="page">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '40px 0', color: 'var(--color-text-muted)' }}>
          <div className="login-spinner" style={{ borderTopColor: 'var(--color-primary)' }} />
          <span>Chargement du dossier...</span>
        </div>
      </div>
    );
  }

  if (!fiche) {
    return (
      <div className="page etat-erreur" role="alert">
        <h1>Demande introuvable</h1>
        <p>Le dossier demandé n'existe pas ou a été supprimé.</p>
        <Link to="/demandes" className="btn btn-primary">Retour aux demandes</Link>
      </div>
    );
  }

  const { demande, historique, etude, devis, travaux, miseEnService, transitionsPossibles } = fiche;
  const typeBranchementAffiche = (() => {
    const brut = (demande.type_autre || demande.type_branchement || '').trim();
    if (!brut) return 'Branchement d\'eau potable';
    if (brut.startsWith('Branchement d\'eau potable')) return 'Branchement d\'eau potable';
    if (brut.startsWith('Extension réseau AEP') || /extension/i.test(brut)) return 'Extension réseau AEP';
    if (brut.startsWith('Rénovation de branchement') || /rénovation/i.test(brut)) return 'Rénovation de branchement';
    if (brut.startsWith('Travaux de résiliation') || /résiliation/i.test(brut)) return 'Travaux de résiliation';
    if (brut.startsWith('Autres') || /autres/i.test(brut)) return 'Autres';
    return brut;
  })();
  const nomDemandeur = demande.est_personne_morale
    ? demande.raison_sociale
    : `${demande.demandeur_nom} ${demande.demandeur_prenom}`;

  const STATUTS_AVEC_ETUDE = new Set([
    'ETUDE_TERMINEE',
    'DEVIS_EMIS',
    'DEVIS_PAYE',
    'TRAVAUX_EN_COURS',
    'TRAVAUX_TERMINES',
    'MISE_EN_SERVICE'
  ]);

  const estEtudeTerminee = STATUTS_AVEC_ETUDE.has(demande.statut_actuel)
    || Boolean(etude?.date_visite || etude?.faisabilite)
    || Boolean(historique?.some((h) => h.code_statut === 'ETUDE_TERMINEE'));

  const devisListe = Array.isArray(devis) ? devis : (devis ? [devis] : []);
  const estDevisPayeOuTravaux = Boolean(
    travaux ||
    ['DEVIS_PAYE', 'TRAVAUX_EN_COURS', 'TRAVAUX_TERMINES', 'MISE_EN_SERVICE'].includes(demande.statut_actuel) ||
    (devisListe.length > 0 && devisListe.every((item) => item.statut_paiement === 'PAYE'))
  );

  function handleImprimerDevis() {
    if (!estEtudeTerminee) {
      notifierErreur("L'étude technique doit être terminée avant de pouvoir imprimer la demande d'établissement de devis.");
      return;
    }
    const dateEtude = historique?.find((h) => h.code_statut === 'ETUDE_TERMINEE')?.date_changement
      || etude?.date_visite
      || etude?.date_creation
      || (demande.statut_actuel === 'ETUDE_TERMINEE' ? demande.date_maj : null)
      || new Date();
    imprimerDevis({ ...demande, date_etude_terminee: dateEtude, etude, historique }, null, dateEtude);
  }

  function handleImprimerOrdreExecution() {
    if (!estDevisPayeOuTravaux) {
      notifierErreur("Le devis doit être payé avant de pouvoir imprimer l'ordre d'exécution.");
      return;
    }
    imprimerOrdreExecution({
      ...demande,
      travaux,
      devis,
      etude,
      miseEnService
    });
  }

  return (
    <div className="page">
      <Breadcrumbs
        items={[
          { label: 'Tableau de bord', path: '/', icon: '📊' },
          { label: 'Demandes', path: '/demandes' },
          { label: demande.numero_demande }
        ]}
      />

      <header className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h1 className="mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span>{demande.numero_demande}</span>
              <button
                type="button"
                className="btn-copier-inline"
                onClick={() => copier(demande.numero_demande, 'numero')}
                title="Copier le numéro de dossier"
                aria-label="Copier le numéro de dossier"
              >
                {copieChamp === 'numero' ? '✓ Copié' : '📋'}
              </button>
            </h1>
            <StatutBadge code={demande.statut_actuel} />
          </div>
          <p style={{ color: 'var(--color-text-muted)', marginTop: 4 }}>
            {nomDemandeur} · {demande.telephone || demande.telephone_secondaire || 'Téléphone non renseigné'} · Déposée le {new Date(demande.date_depot).toLocaleDateString('fr-FR')}
          </p>
        </div>

        {/* Boutons d'actions et d'impression */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => imprimerDemande(demande)}
            title="Imprimer la demande de branchement"
          >
            <span>🖨</span> Imprimer demande
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => imprimerAccuse(demande)}
            title="Imprimer l'accusé de réception (2 coupons A4)"
          >
            <span>🖨</span> Imprimer accusé
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleImprimerDevis}
            style={{ opacity: estEtudeTerminee ? 1 : 0.6 }}
            title={estEtudeTerminee ? "Imprimer la demande d'établissement de devis" : "L'étude technique doit être terminée pour imprimer la demande de devis"}
          >
            <span>{estEtudeTerminee ? '🖨' : '🔒'}</span> Demande devis
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleImprimerOrdreExecution}
            style={{ opacity: estDevisPayeOuTravaux ? 1 : 0.6 }}
            title={estDevisPayeOuTravaux ? "Imprimer l'ordre d'exécution des travaux" : "Le devis doit être payé pour imprimer l'ordre d'exécution"}
          >
            <span>{estDevisPayeOuTravaux ? '🖨' : '🔒'}</span> Ordre d'exécution
          </button>
          <Link to={`/demandes/${id}/modifier`} className="btn btn-secondary">
            <span>✎</span> Modifier
          </Link>
        </div>
      </header>

      {/* Pipeline interactif */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)' }}>
            AVANCEMENT DANS LE PIPELINE D'EXÉCUTION
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
            <button type="button" className="btn-lien" onClick={() => defilerVers('panneau-etude')}>Étude ↓</button>
            <button type="button" className="btn-lien" onClick={() => defilerVers('panneau-devis')}>Devis ↓</button>
            <button type="button" className="btn-lien" onClick={() => defilerVers('panneau-travaux')}>Travaux ↓</button>
            <button type="button" className="btn-lien" onClick={() => defilerVers('panneau-mes')}>Mise en service ↓</button>
          </div>
        </div>
        <Pipeline statutActuel={demande.statut_actuel} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Informations générales */}
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ marginBottom: 18, fontSize: 16 }}>Informations générales du dossier</h3>
            <div className="grille-info">
              <div>
                <span className="info-label">Type de branchement</span>
                <div style={{ fontWeight: 600 }}>{typeBranchementAffiche}</div>
              </div>
              <div>
                <span className="info-label">Agence de rattachement</span>
                <div>{demande.nom_agence}</div>
              </div>
              <div>
                <span className="info-label">Commune</span>
                <div>{demande.nom_commune}</div>
              </div>
              <div>
                <span className="info-label">Téléphone principal</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{demande.telephone || '—'}</span>
                  {demande.telephone && (
                    <button
                      type="button"
                      className="btn-copier-mini"
                      onClick={() => copier(demande.telephone, 'tel')}
                      title="Copier le téléphone"
                    >
                      {copieChamp === 'tel' ? '✓' : '📋'}
                    </button>
                  )}
                </div>
              </div>
              <div>
                <span className="info-label">Téléphone secondaire</span>
                <div>{demande.telephone_secondaire || '—'}</div>
              </div>
              <div>
                <span className="info-label">{demande.est_personne_morale ? 'Raison sociale' : 'CIN / N° Pièce'}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{demande.est_personne_morale ? demande.raison_sociale : (demande.cin || '—')}</span>
                  {demande.cin && (
                    <button
                      type="button"
                      className="btn-copier-mini"
                      onClick={() => copier(demande.cin, 'cin')}
                      title="Copier le numéro de CIN"
                    >
                      {copieChamp === 'cin' ? '✓' : '📋'}
                    </button>
                  )}
                </div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <span className="info-label">Adresse du branchement</span>
                <div style={{ fontWeight: 500 }}>{demande.adresse_branchement}</div>
              </div>
              {demande.observations && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <span className="info-label">Observations & Remarques</span>
                  <div style={{ background: 'var(--color-surface-sunken)', padding: '8px 12px', borderRadius: 8, fontStyle: 'italic' }}>
                    {demande.observations}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Panneaux avec ancres de défilement fluide */}
          <div id="panneau-etude">
            <PanneauEtude idDemande={id} demande={demande} etude={etude} onEnregistre={recharger} />
          </div>
          <div id="panneau-devis">
            <PanneauDevis idDemande={id} devis={devis} etude={etude} onEnregistre={recharger} />
          </div>
          <div id="panneau-travaux">
            <PanneauTravaux
              idDemande={id}
              demande={demande}
              travaux={travaux}
              devis={devis}
              etude={etude}
              miseEnService={miseEnService}
              onEnregistre={recharger}
            />
          </div>
          <div id="panneau-mes">
            <PanneauMiseEnService idDemande={id} miseEnService={miseEnService} travaux={travaux} onEnregistre={recharger} />
          </div>

        </div>

        {/* Colonne latérale : Actions de workflow & Historique */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {transitionsPossibles?.length > 0 && (
            <div className="card" style={{ padding: 22 }}>
              <h3 style={{ marginBottom: 12, fontSize: 15 }}>Faire progresser le statut</h3>
              <textarea
                rows={2}
                placeholder="Motif / Commentaire (obligatoire pour un rejet)..."
                required={transitionsPossibles.includes('REJETEE') || demande.statut_actuel === 'REJETEE'}
                value={commentaire}
                onChange={(e) => setCommentaire(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--color-border)', borderRadius: 8, marginBottom: 10 }}
              />

              {/* Raccourcis motifs de rejet rapides si rejet possible */}
              {transitionsPossibles.includes('REJETEE') && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>
                    Motifs prédéfinis :
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {MOTIFS_REJET_RAPIDES.map((motif, i) => (
                      <button
                        key={i}
                        type="button"
                        className="btn-motif-rapide"
                        onClick={() => setCommentaire(motif)}
                      >
                        • {motif}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {transitionsPossibles.map((code) => (
                  <button
                    key={code}
                    className={`btn ${code === 'REJETEE' || code === 'ANNULEE' ? 'btn-danger' : 'btn-primary'}`}
                    onClick={() => changerStatut(code)}
                    disabled={enTransition || ((code === 'REJETEE' || demande.statut_actuel === 'REJETEE') && !commentaire.trim())}
                  >
                    → {LIBELLES_STATUT[code]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chronologie historique */}
          <div className="card" style={{ padding: 22 }}>
            <h3 style={{ marginBottom: 16, fontSize: 15 }}>Historique d'activité</h3>
            <div className="chronologie">
              {historique.map((h) => (
                <div key={h.id_historique} className="chronologie-item">
                  <div className="chronologie-point" />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{h.statut_libelle}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 2 }}>
                      {new Date(h.date_changement).toLocaleString('fr-FR')} · {h.agent_nom}
                    </div>
                    {h.commentaire && (
                      <div style={{ fontSize: 12, marginTop: 4, fontStyle: 'italic', background: 'var(--color-surface-sunken)', padding: '4px 8px', borderRadius: 6 }}>
                        "{h.commentaire}"
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
