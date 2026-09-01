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
  const [detailsOuverts, setDetailsOuverts] = useState({});

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

  function exporterHistoriqueCSV() {
    if (!historique || historique.length === 0) return;

    const entetes = ['Date', 'Type', 'Statut', 'Agent', 'Description', 'Détails'];
    const lignes = historique.map((h) => {
      const type = h.type_historique === 'MODIFICATION' ? 'Modification' : 'Statut';
      const statut = h.type_historique === 'MODIFICATION' ? '—' : (h.statut_libelle || '');
      const description = h.type_historique === 'MODIFICATION'
        ? (h.description || 'Mise à jour du dossier')
        : (h.commentaire || '');

      let detailsText = '';
      if (h.type_historique === 'MODIFICATION' && h.details) {
        try {
          const details = typeof h.details === 'string' ? JSON.parse(h.details) : h.details;
          const passages = [];

          function extraire(obj, prefix = '') {
            if (!obj || typeof obj !== 'object') return;
            Object.entries(obj).forEach(([cle, valeur]) => {
              if (valeur === null || valeur === undefined || valeur === '') return;
              if (typeof valeur === 'object') {
                extraire(valeur, `${prefix}${cle} / `);
                return;
              }
              passages.push(`${prefix || ''}${cle}: ${String(valeur)}`);
            });
          }

          extraire(details);
          detailsText = passages.join(' ; ');
        } catch {
          detailsText = '';
        }
      }

      const valeurs = [
        new Date(h.date_changement).toLocaleString('fr-FR'),
        type,
        statut,
        h.agent_nom || '',
        description,
        detailsText
      ].map((valeur) => `"${String(valeur ?? '').replace(/"/g, '""')}"`);

      return valeurs.join(';');
    });

    const csvContent = '\uFEFF' + [entetes.join(';'), ...lignes].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = `historique_demande_${demande.numero_demande}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(lien);
    lien.click();
    document.body.removeChild(lien);
    URL.revokeObjectURL(url);
  }

  if (chargement) {
    return (
      <div className="page" aria-busy="true" aria-label="Chargement du dossier">
        <div className="squelette squelette-titre" style={{ marginBottom: 8 }} />
        <div className="squelette squelette-sous-titre" style={{ marginBottom: 24 }} />
        <div className="card pipeline-carte squelette" style={{ height: 80, marginBottom: 20 }} />
        <div className="grille-detail">
          <div className="card squelette" style={{ height: 280 }} />
          <div className="card squelette" style={{ height: 200 }} />
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

  const { demande, historique, etude, devis, travaux, transitionsPossibles } = fiche;
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
    'TRAVAUX_TERMINES'
  ]);

  const estEtudeTerminee = STATUTS_AVEC_ETUDE.has(demande.statut_actuel)
    || Boolean(etude?.date_visite || etude?.faisabilite)
    || Boolean(historique?.some((h) => h.code_statut === 'ETUDE_TERMINEE'));

  const devisListe = Array.isArray(devis) ? devis : (devis ? [devis] : []);
  const estDevisPaye = devisListe.some((item) => item.statut_paiement === 'PAYE');
  const estDevisPayeOuTravaux = Boolean(
    travaux ||
    ['DEVIS_PAYE', 'TRAVAUX_EN_COURS', 'TRAVAUX_TERMINES'].includes(demande.statut_actuel) ||
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
      etude
    });
  }

  async function scellerDemande() {
    const confirme = await demanderConfirmation('Sceller cette demande ? Les modifications et la suppression seront interdites définitivement.');
    if (!confirme) return;

    try {
      await client.patch(`/demandes/${id}/verrouiller`);
      notifierSucces('Demande scellée avec succès.');
      recharger();
    } catch (err) {
      notifierErreur(err.response?.data?.erreur || 'Impossible de sceller la demande.');
    }
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
        <div className="page-actions">
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
          <button
            type="button"
            className="btn btn-secondary"
            onClick={exporterHistoriqueCSV}
            title="Exporter l'historique de la demande au format CSV"
            disabled={!historique || historique.length === 0}
          >
            <span>📄</span> Exporter historique
          </button>
          {demande.statut_actuel === 'TRAVAUX_TERMINES' && !demande.est_verrouillee && (
            <button type="button" className="btn btn-primary" onClick={scellerDemande}>
              <span>🔒</span> Sceller la demande
            </button>
          )}
          {!demande.est_verrouillee && (
            <Link to={`/demandes/${id}/modifier`} className="btn btn-secondary">
              <span>✎</span> Modifier
            </Link>
          )}
          {demande.est_verrouillee && (
            <button type="button" className="btn btn-secondary" disabled style={{ opacity: 0.8 }}>
              <span>🔒</span> Demande scellée
            </button>
          )}
        </div>
      </header>

      {/* Pipeline interactif */}
      <div className="card pipeline-carte">
        <div className="pipeline-carte-entete">
          <div className="pipeline-carte-titre">
            Avancement dans le pipeline d'exécution
          </div>
          <nav className="pipeline-nav" aria-label="Accès rapide aux panneaux du dossier">
            <button type="button" className="btn-lien" onClick={() => defilerVers('panneau-etude')}>Étude ↓</button>
            <button type="button" className="btn-lien" onClick={() => defilerVers('panneau-devis')}>Devis ↓</button>
            <button type="button" className="btn-lien" onClick={() => defilerVers('panneau-travaux')}>Travaux ↓</button>
          </nav>
        </div>
        <Pipeline statutActuel={demande.statut_actuel} showLegend />
        <div className="pipeline-statut-actuel">
          <StatutBadge code={demande.statut_actuel} />
          <span>— {LIBELLES_STATUT[demande.statut_actuel]}</span>
        </div>
      </div>

      <div className="grille-detail">
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
            <PanneauEtude idDemande={id} demande={demande} etude={etude} devisPaye={estDevisPaye} onEnregistre={recharger} />
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
              onEnregistre={recharger}
            />
          </div>

        </div>

        {/* Colonne latérale : Actions de workflow & Historique */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {transitionsPossibles?.length > 0 && (
            <div className="card" style={{ padding: 22 }}>
              <h3 style={{ marginBottom: 12, fontSize: 15 }}>Faire progresser le statut</h3>
              <div className="champ" style={{ marginBottom: 10 }}>
                <label htmlFor="commentaire-transition">Motif / commentaire</label>
                <textarea
                  id="commentaire-transition"
                  rows={2}
                  placeholder="Obligatoire pour un rejet…"
                  required={transitionsPossibles.includes('REJETEE') || demande.statut_actuel === 'REJETEE'}
                  value={commentaire}
                  onChange={(e) => setCommentaire(e.target.value)}
                  aria-describedby="aide-commentaire-transition"
                />
                <span id="aide-commentaire-transition" className="champ-aide">
                  {transitionsPossibles.includes('REJETEE')
                    ? 'Un motif est obligatoire pour rejeter la demande.'
                    : 'Optionnel pour les autres transitions.'}
                </span>
              </div>

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
                    type="button"
                    className={`btn ${code === 'REJETEE' || code === 'ANNULEE' ? 'btn-danger' : 'btn-primary'}`}
                    onClick={() => changerStatut(code)}
                    disabled={enTransition || ((code === 'REJETEE' || demande.statut_actuel === 'REJETEE') && !commentaire.trim())}
                    aria-busy={enTransition}
                  >
                    {enTransition ? '…' : '→'} {LIBELLES_STATUT[code]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chronologie historique */}
          <div className="card" style={{ padding: 22 }}>
            <h3 style={{ marginBottom: 16, fontSize: 15 }}>Historique d'activité</h3>
            <div className="chronologie">
              {historique.map((h) => {
                const itemKey = `${h.type_historique}-${h.id_historique}`;
                const libelle = h.type_historique === 'MODIFICATION' ? 'Mise à jour du dossier' : h.statut_libelle;
                const commentaire = h.type_historique === 'MODIFICATION' ? (h.description || 'Données du dossier mises à jour.') : h.commentaire;

                let details = null;
                if (h.type_historique === 'MODIFICATION' && h.details) {
                  try {
                    details = typeof h.details === 'string' ? JSON.parse(h.details) : h.details;
                  } catch {
                    details = null;
                  }
                }

                const champsModifies = details && typeof details === 'object'
                  ? Object.entries(details)
                      .filter(([, valeur]) => valeur !== null && valeur !== undefined && valeur !== '')
                      .flatMap(([cle, valeur]) => {
                        if (cle === 'demandeur' && typeof valeur === 'object') {
                          return Object.entries(valeur)
                            .filter(([, v]) => v !== null && v !== undefined && v !== '')
                            .map(([sousCle, sousValeur]) => ({
                              libelle: {
                                qualite_demandeur: 'Qualité du demandeur',
                                est_personne_morale: 'Type de demandeur',
                                nom: 'Nom',
                                prenom: 'Prénom',
                                raison_sociale: 'Raison sociale'
                              }[sousCle] || sousCle, valeur: sousValeur
                            }));
                        }

                        const libelleChamp = {
                          id_type: 'Type de branchement',
                          type_autre: 'Précision du type',
                          adresse_branchement: 'Adresse du branchement',
                          id_commune: 'Commune du branchement',
                          observations: 'Observations',
                          qualite_demandeur: 'Qualité du demandeur',
                          est_personne_morale: 'Type de demandeur',
                          nom: 'Nom',
                          prenom: 'Prénom',
                          raison_sociale: 'Raison sociale'
                        }[cle] || cle;

                        return [{ libelle: libelleChamp, valeur }];
                      })
                  : [];

                const detailsOuvertsPourCetItem = Boolean(detailsOuverts[itemKey]);

                return (
                  <div key={itemKey} className="chronologie-item">
                    <div className="chronologie-point" />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{libelle}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 2 }}>
                        {new Date(h.date_changement).toLocaleString('fr-FR')} · {h.agent_nom}
                      </div>
                      {commentaire && (
                        <div style={{ fontSize: 12, marginTop: 4, fontStyle: 'italic', background: 'var(--color-surface-sunken)', padding: '4px 8px', borderRadius: 6 }}>
                          "{commentaire}"
                        </div>
                      )}

                      {h.type_historique === 'MODIFICATION' && champsModifies.length > 0 && (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ marginTop: 8, padding: '6px 10px', fontSize: 11.5 }}
                          onClick={() => setDetailsOuverts((prev) => ({ ...prev, [itemKey]: !prev[itemKey] }))}
                        >
                          {detailsOuvertsPourCetItem ? 'Masquer les détails' : 'Voir les détails'}
                        </button>
                      )}

                      {h.type_historique === 'MODIFICATION' && detailsOuvertsPourCetItem && champsModifies.length > 0 && (
                        <div style={{ fontSize: 11.5, marginTop: 8, background: 'var(--color-surface-sunken)', padding: '8px 10px', borderRadius: 6 }}>
                          {champsModifies.map((champ, index) => (
                            <div key={`${champ.libelle}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
                              <strong style={{ flexShrink: 0 }}>{champ.libelle}</strong>
                              <span style={{ textAlign: 'right', color: 'var(--color-text)' }}>
                                {typeof champ.valeur === 'object' ? JSON.stringify(champ.valeur) : String(champ.valeur)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
