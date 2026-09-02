import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import client from '../api/client';
import StatutBadge from '../components/StatutBadge';
import Pipeline from '../components/Pipeline';
import Breadcrumbs from '../components/Breadcrumbs';
import { ETAPES_PIPELINE, STATUTS_TERMINAUX } from '../constants/statuts';
import { demanderConfirmation, notifierErreur } from '../utils/notifications';

function nettoyerTexte(valeur, defaut = '') {
  const texte = String(valeur ?? '').replace(/[<>"']/g, '').replace(/\s{2,}/g, ' ').trim();
  return texte || defaut;
}

const ONGLETS_RAPIDES = [
  { id: 'tous', label: 'Toutes', statut: '' },
  { id: 'en_cours', label: 'En cours', statut: 'EN_COURS' },
  { id: 'devis', label: 'Devis à payer', statut: 'DEVIS_EMIS' },
  { id: 'travaux', label: 'Travaux', statut: 'TRAVAUX_EN_COURS' },
  { id: 'rejetee', label: 'Rejetées / Annulées', statut: 'REJETEE' }
];

export default function ListeDemandes() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [demandes, setDemandes] = useState([]);
  const [total, setTotal] = useState(0);
  const [statutFiltre, setStatutFiltre] = useState(() => searchParams.get('statut') || '');
  const [recherche, setRecherche] = useState(() => searchParams.get('q') || '');
  const [chargement, setChargement] = useState(true);
  const [erreurChargement, setErreurChargement] = useState(false);
  const [triColonne, setTriColonne] = useState('date_depot');
  const [triOrdre, setTriOrdre] = useState('desc'); // 'asc' | 'desc'

  const navigate = useNavigate();

  // Sync state if URL searchParams change
  useEffect(() => {
    const statutUrl = searchParams.get('statut');
    if (statutUrl !== null && statutUrl !== statutFiltre) {
      setStatutFiltre(statutUrl);
    }
  }, [searchParams]);

  async function supprimerDemande(demande) {
    const confirme = await demanderConfirmation(`Supprimer la demande ${nettoyerTexte(demande.numero_demande)} ? Cette action est irréversible.`);
    if (!confirme) return;

    try {
      await client.delete(`/demandes/${demande.id_demande}`);
      setDemandes((liste) => liste.filter((item) => item.id_demande !== demande.id_demande));
      setTotal((valeur) => Math.max(0, valeur - 1));
    } catch (err) {
      notifierErreur(nettoyerTexte(err.response?.data?.erreur || 'Impossible de supprimer la demande.'));
    }
  }

  useEffect(() => {
    setChargement(true);
    setErreurChargement(false);
    const params = {};
    if (statutFiltre && statutFiltre !== 'EN_COURS') {
      params.statut = statutFiltre;
    }
    if (recherche.trim()) {
      params.recherche = recherche.trim();
    }

    const delai = setTimeout(() => {
      client.get('/demandes', { params })
        .then((res) => {
          let list = res.data.demandes || [];
          if (statutFiltre === 'EN_COURS') {
            list = list.filter((d) => !['REJETEE', 'ANNULEE', 'TRAVAUX_TERMINES'].includes(d.statut_actuel));
          }
          setDemandes(list);
          setTotal(res.data.total);
        })
        .catch(() => {
          setErreurChargement(true);
          notifierErreur('Impossible de charger les demandes.');
        })
        .finally(() => setChargement(false));
    }, 250);

    return () => clearTimeout(delai);
  }, [statutFiltre, recherche]);

  // Client-side interactive sorting
  const demandesTriees = useMemo(() => {
    return [...demandes].sort((a, b) => {
      let aVal = a[triColonne] || '';
      let bVal = b[triColonne] || '';

      if (triColonne === 'date_depot') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      } else if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return triOrdre === 'asc' ? -1 : 1;
      if (aVal > bVal) return triOrdre === 'asc' ? 1 : -1;
      return 0;
    });
  }, [demandes, triColonne, triOrdre]);

  function changerTri(colonne) {
    if (triColonne === colonne) {
      setTriOrdre((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setTriColonne(colonne);
      setTriOrdre('asc');
    }
  }

  function gererTriClavier(e, colonne) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      changerTri(colonne);
    }
  }

  function gererLigneClavier(e, idDemande) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      ouvrirDemande(idDemande);
    }
  }

  function ouvrirDemande(idDemande) {
    navigate(`/demandes/${idDemande}`);
  }

  function reinitialiserFiltres() {
    setStatutFiltre('');
    setRecherche('');
    setSearchParams({});
  }

  function demandeSupprimable(demande) {
    return !demande.est_verrouillee && (demande.statut_actuel === 'ANNULEE' || demande.statut_paiement !== 'PAYE');
  }

  // Export CSV
  function exporterCSV() {
    if (demandesTriees.length === 0) return;
    const entetes = [
      'N° Demande', 'Demandeur', 'Téléphone principal', 'Adresse de résidence du demandeur',
      'Commune de résidence', 'Adresse exacte du futur branchement', 'Commune du branchement',
      'Type', 'Observations & Notes complémentaires', 'Statut', 'Date de dépôt'
    ];
    const lignes = demandesTriees.map((d) => [
      `"${d.numero_demande}"`,
      `"${d.demandeur}"`,
      `"${d.telephone || ''}"`,
      `"${d.adresse_residence || ''}"`,
      `"${d.nom_commune_residence || ''}"`,
      `"${d.adresse_branchement || ''}"`,
      `"${d.nom_commune_branchement || d.nom_commune || ''}"`,
      `"${d.type_branchement || ''}"`,
      `"${d.observations || ''}"`,
      `"${d.statut_actuel || ''}"`,
      `"${new Date(d.date_depot).toLocaleDateString('fr-FR')}"`
    ]);

    const csvContent = '\uFEFF' + [entetes.join(';'), ...lignes.map((l) => l.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const lien = document.createElement('a');
    lien.setAttribute('href', url);
    lien.setAttribute('download', `demandes_branchement_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(lien);
    lien.click();
    document.body.removeChild(lien);
  }

  return (
    <div className="page">
      <Breadcrumbs items={[{ label: 'Tableau de bord', path: '/', icon: '📊' }, { label: 'Demandes' }]} />

      <header className="page-header">
        <div>
          <h1>Demandes de branchement</h1>
          <p style={{ color: 'var(--color-text-muted)', marginTop: 4 }}>
            {total} dossier{total > 1 ? 's' : ''} enregistré{total > 1 ? 's' : ''} · Gestion du pipeline et suivi
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              const dossier = demandesTriees[0];
              if (!dossier) {
                notifierErreur('Aucune demande n’est actuellement sélectionnée pour créer un devis.');
                return;
              }
              navigate(`/demandes/${dossier.id_demande}/devis/nouveau`);
            }}
            disabled={demandesTriees.length === 0 || demandesTriees.some((d) => d.est_verrouillee)}
            title="Créer un devis depuis la première demande visible"
          >
            <span>💳</span> Créer un devis
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={exporterCSV}
            disabled={demandesTriees.length === 0}
            title="Exporter la liste au format CSV / Excel"
          >
            <span>📥</span> Exporter CSV
          </button>
          <Link to="/demandes/nouvelle" className="btn btn-primary">
            <span>➕</span> Nouvelle demande
          </Link>
        </div>
      </header>

      {/* Onglets interactifs rapides */}
      <div className="onglets-statuts" role="tablist">
        {ONGLETS_RAPIDES.map((onglet) => {
          const estActif = statutFiltre === onglet.statut;
          return (
            <button
              key={onglet.id}
              type="button"
              role="tab"
              aria-selected={estActif}
              className={`onglet-statut-btn ${estActif ? 'actif' : ''}`}
              onClick={() => {
                setStatutFiltre(onglet.statut);
                setSearchParams(onglet.statut ? { statut: onglet.statut } : {});
              }}
            >
              <span>{onglet.label}</span>
            </button>
          );
        })}
      </div>

      {/* Barre de filtre et recherche intelligente */}
      <div className="card filtres-demandes" style={{ padding: 14, display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <input
            placeholder="Recherche instantanée par N°, nom de client, commune ou téléphone..."
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            style={{ width: '100%', padding: '10px 36px 10px 38px', borderRadius: 8 }}
          />
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.6, pointerEvents: 'none' }}>
            🔍
          </span>
          {recherche && (
            <button
              type="button"
              onClick={() => setRecherche('')}
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--color-text-muted)',
                fontSize: 14
              }}
              title="Effacer la recherche"
              aria-label="Effacer la recherche"
            >
              ✕
            </button>
          )}
        </div>

        <select
          value={statutFiltre}
          onChange={(e) => {
            setStatutFiltre(e.target.value);
            setSearchParams(e.target.value ? { statut: e.target.value } : {});
          }}
          style={{ padding: '10px 14px', borderRadius: 8, minWidth: 200 }}
        >
          <option value="">Tous les statuts détaillés</option>
          {ETAPES_PIPELINE.map((e) => (
            <option key={e.code} value={e.code}>{e.libelle}</option>
          ))}
          {Object.entries(STATUTS_TERMINAUX).map(([code, v]) => (
            <option key={code} value={code}>{v.libelle}</option>
          ))}
        </select>
      </div>

      {/* Tableau des demandes avec tri interactif */}
      <div className="card tableau-responsive" style={{ overflow: 'hidden' }}>
        <table className="tableau">
          <thead>
            <tr>
              <th
                className="col-triable"
                onClick={() => changerTri('numero_demande')}
                onKeyDown={(e) => gererTriClavier(e, 'numero_demande')}
                tabIndex={0}
                role="columnheader"
                aria-sort={triColonne === 'numero_demande' ? (triOrdre === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>N° Demande</span>
                  {triColonne === 'numero_demande' && <span>{triOrdre === 'asc' ? '↑' : '↓'}</span>}
                </div>
              </th>
              <th
                className="col-triable"
                onClick={() => changerTri('demandeur')}
                onKeyDown={(e) => gererTriClavier(e, 'demandeur')}
                tabIndex={0}
                role="columnheader"
                aria-sort={triColonne === 'demandeur' ? (triOrdre === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>Demandeur</span>
                  {triColonne === 'demandeur' && <span>{triOrdre === 'asc' ? '↑' : '↓'}</span>}
                </div>
              </th>
              <th
                className="col-triable"
                onClick={() => changerTri('nom_commune')}
                onKeyDown={(e) => gererTriClavier(e, 'nom_commune')}
                tabIndex={0}
                role="columnheader"
                aria-sort={triColonne === 'nom_commune' ? (triOrdre === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>Commune</span>
                  {triColonne === 'nom_commune' && <span>{triOrdre === 'asc' ? '↑' : '↓'}</span>}
                </div>
              </th>
              <th
                className="col-triable"
                onClick={() => changerTri('type_branchement')}
                onKeyDown={(e) => gererTriClavier(e, 'type_branchement')}
                tabIndex={0}
                role="columnheader"
                aria-sort={triColonne === 'type_branchement' ? (triOrdre === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>Type</span>
                  {triColonne === 'type_branchement' && <span>{triOrdre === 'asc' ? '↑' : '↓'}</span>}
                </div>
              </th>
              <th>Progression</th>
              <th
                className="col-triable"
                onClick={() => changerTri('statut_actuel')}
                onKeyDown={(e) => gererTriClavier(e, 'statut_actuel')}
                tabIndex={0}
                role="columnheader"
                aria-sort={triColonne === 'statut_actuel' ? (triOrdre === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>Statut</span>
                  {triColonne === 'statut_actuel' && <span>{triOrdre === 'asc' ? '↑' : '↓'}</span>}
                </div>
              </th>
              <th
                className="col-triable"
                onClick={() => changerTri('date_depot')}
                onKeyDown={(e) => gererTriClavier(e, 'date_depot')}
                tabIndex={0}
                role="columnheader"
                aria-sort={triColonne === 'date_depot' ? (triOrdre === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>Déposée le</span>
                  {triColonne === 'date_depot' && <span>{triOrdre === 'asc' ? '↑' : '↓'}</span>}
                </div>
              </th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {erreurChargement && !chargement && (
              <tr>
                <td colSpan={8}>
                  <div className="etat-vide" role="alert">
                    <span className="etat-vide-icone" aria-hidden="true">⚠️</span>
                    <strong className="etat-vide-titre">Échec du chargement</strong>
                    <p className="etat-vide-texte">
                      Impossible de récupérer la liste des demandes. Vérifiez votre connexion et réessayez.
                    </p>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => {
                        setErreurChargement(false);
                        setChargement(true);
                        const params = {};
                        if (statutFiltre && statutFiltre !== 'EN_COURS') params.statut = statutFiltre;
                        if (recherche.trim()) params.recherche = recherche.trim();
                        client.get('/demandes', { params })
                          .then((res) => {
                            let list = res.data.demandes || [];
                            if (statutFiltre === 'EN_COURS') {
                              list = list.filter((d) => !['REJETEE', 'ANNULEE', 'TRAVAUX_TERMINES', 'SCELLEE'].includes(d.statut_actuel));
                            }
                            setDemandes(list);
                            setTotal(res.data.total);
                          })
                          .catch(() => setErreurChargement(true))
                          .finally(() => setChargement(false));
                      }}
                    >
                      Réessayer
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {chargement && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: 36 }}>
                  <div className="etat-chargement-inline">
                    <div className="spinner" aria-hidden="true" />
                    <span>Chargement des demandes en cours…</span>
                  </div>
                </td>
              </tr>
            )}

            {!chargement && !erreurChargement && demandesTriees.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <div className="etat-vide">
                    <span className="etat-vide-icone" aria-hidden="true">📂</span>
                    <strong className="etat-vide-titre">Aucune demande ne correspond à vos critères</strong>
                    <p className="etat-vide-texte">
                      Essayez de modifier votre recherche ou vos filtres de statut.
                    </p>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={reinitialiserFiltres}
                    >
                      Réinitialiser les filtres
                    </button>
                    <Link to="/demandes/nouvelle" className="btn btn-primary">
                      Créer une demande
                    </Link>
                  </div>
                </td>
              </tr>
            )}

            {!chargement && !erreurChargement && demandesTriees.map((d) => (
              <tr
                key={d.id_demande}
                className="ligne-demande"
                onClick={() => ouvrirDemande(d.id_demande)}
                onKeyDown={(e) => gererLigneClavier(e, d.id_demande)}
                tabIndex={0}
                role="link"
                aria-label={`Afficher les détails de la demande ${d.numero_demande}`}
              >
                <td>
                  <span className="mono" style={{ color: 'var(--color-primary)', fontWeight: 700, fontSize: 13 }}>
                    {d.numero_demande}
                  </span>
                </td>
                <td>
                  <div style={{ fontWeight: 600 }}>{d.demandeur}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 2 }}>
                    {[d.telephone, d.telephone_secondaire].filter(Boolean).join(' / ') || 'Pas de numéro'}
                  </div>
                </td>
                <td>{d.nom_commune || '—'}</td>
                <td>
                  <span style={{ fontSize: 12, padding: '2px 8px', background: 'var(--color-surface-sunken)', borderRadius: 6 }}>
                    {d.type_branchement}
                  </span>
                </td>
                <td style={{ minWidth: 150 }}>
                  <Pipeline statutActuel={d.statut_actuel} compact />
                </td>
                <td>
                  <StatutBadge code={d.statut_actuel} />
                </td>
                <td>
                  <span style={{ fontSize: 12.5 }}>
                    {new Date(d.date_depot).toLocaleDateString('fr-FR')}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
                    {!d.est_verrouillee && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ padding: '6px 10px', fontSize: 12, whiteSpace: 'nowrap' }}
                        onClick={() => navigate(`/demandes/${d.id_demande}/devis/nouveau`)}
                        title="Créer un devis pour cette demande"
                        aria-label={`Créer un devis pour la demande ${d.numero_demande}`}
                      >
                        <span>💳</span> Devis
                      </button>
                    )}
                    {!d.est_verrouillee && (
                      <Link
                        to={`/demandes/${d.id_demande}/modifier`}
                        className="btn btn-secondary btn-icon"
                        title="Modifier la demande"
                        aria-label={`Modifier la demande ${d.numero_demande}`}
                      >
                        ✎
                      </Link>
                    )}
                    {demandeSupprimable(d) && (
                      <button
                        type="button"
                        className="btn btn-danger btn-icon"
                        onClick={() => supprimerDemande(d)}
                        title="Supprimer la demande"
                        aria-label={`Supprimer la demande ${d.numero_demande}`}
                      >
                        🗑
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
