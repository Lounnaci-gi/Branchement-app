import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import client from '../api/client';
import { ETAPES_PIPELINE } from '../constants/statuts';
import { notifierErreur } from '../utils/notifications';
import Breadcrumbs from '../components/Breadcrumbs';

function CompteurAnime({ cible, duree = 800, suffixe = '' }) {
  const [valeur, setValeur] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = Number(cible) || 0;
    if (end === 0) {
      setValeur(0);
      return;
    }

    const increment = end / (duree / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setValeur(end);
        clearInterval(timer);
      } else {
        setValeur(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [cible, duree]);

  return <span>{valeur.toLocaleString('fr-FR')}{suffixe}</span>;
}

export default function TableauDeBord() {
  const [donnees, setDonnees] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [rafraichissement, setRafraichissement] = useState(false);
  const [tentative, setTentative] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    setChargement(true);
    client.get('/dashboard')
      .then((res) => setDonnees(res.data))
      .catch(() => notifierErreur('Impossible de charger les données du tableau de bord.'))
      .finally(() => {
        setChargement(false);
        setRafraichissement(false);
      });
  }, [tentative]);

  function actualiser() {
    setRafraichissement(true);
    setTentative((v) => v + 1);
  }

  function activerClavier(e, action) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      action();
    }
  }

  if (chargement && !donnees) {
    return (
      <div className="page">
        <header className="page-header">
          <div>
            <div className="squelette squelette-titre" />
            <div className="squelette squelette-sous-titre" />
          </div>
          <div className="squelette squelette-bouton" />
        </header>
        <div className="grille-kpi" aria-label="Chargement des indicateurs">
          {Array.from({ length: 5 }, (_, index) => <div className="card kpi squelette-carte" key={index} />)}
        </div>
      </div>
    );
  }

  if (!donnees) {
    return (
      <div className="page etat-erreur" role="alert">
        <h1>Tableau de bord indisponible</h1>
        <p>Impossible de charger les données.</p>
        <button type="button" className="btn btn-primary" onClick={() => setTentative((v) => v + 1)}>
          Réessayer
        </button>
      </div>
    );
  }

  const total = donnees.parStatut
    .filter((s) => !['REJETEE', 'ANNULEE', 'TRAVAUX_TERMINES', 'SCELLEE'].includes(s.code_statut))
    .reduce((s, x) => s + x.total, 0);

  const demandesAchevees = donnees.parStatut
    .find((s) => s.code_statut === 'SCELLEE')?.total || 0;

  const maxTotal = Math.max(...donnees.parStatut.map((s) => s.total), 1);

  return (
    <div className="page">
      <Breadcrumbs items={[{ label: 'Tableau de bord', icon: '📊' }]} />

      <header className="page-header">
        <div>
          <h1>Tableau de bord</h1>
          <p style={{ color: 'var(--color-text-muted)', marginTop: 4 }}>
            Vue d'ensemble du réseau de branchements et indicateurs clés en temps réel
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={actualiser}
            disabled={rafraichissement}
            title="Actualiser les données"
          >
            <span style={{ display: 'inline-block', transform: rafraichissement ? 'rotate(360deg)' : 'none', transition: 'transform 0.6s ease' }}>
              🔄
            </span>
            <span>Actualiser</span>
          </button>
          <Link to="/demandes/nouvelle" className="btn btn-primary">
            <span>➕</span> Nouvelle demande
          </Link>
        </div>
      </header>

      {/* Cartes KPI interactives cliquables */}
      <div className="grille-kpi">
        <div
          className="card kpi kpi-interactive"
          onClick={() => navigate('/demandes')}
          onKeyDown={(e) => activerClavier(e, () => navigate('/demandes'))}
          role="button"
          tabIndex={0}
          title="Voir toutes les demandes actives"
        >
          <div className="kpi-valeur">
            <CompteurAnime cible={total} />
          </div>
          <div className="kpi-label">Demandes actives</div>
          <div className="kpi-footer-hint">Explorer la liste →</div>
        </div>

        <div
          className="card kpi kpi-interactive"
          onClick={() => navigate('/demandes?statut=TRAVAUX_TERMINES')}
          onKeyDown={(e) => activerClavier(e, () => navigate('/demandes?statut=TRAVAUX_TERMINES'))}
          role="button"
          tabIndex={0}
          title="Voir les demandes achevées"
        >
          <div className="kpi-valeur" style={{ color: 'var(--color-success)' }}>
            <CompteurAnime cible={demandesAchevees} />
          </div>
          <div className="kpi-label">Demandes achevées</div>
          <div className="kpi-footer-hint">Travaux terminés →</div>
        </div>

        <div
          className="card kpi kpi-interactive"
          onClick={() => navigate('/demandes')}
          onKeyDown={(e) => activerClavier(e, () => navigate('/demandes'))}
          role="button"
          tabIndex={0}
          title="Voir les demandes de ce mois"
        >
          <div className="kpi-valeur">
            <CompteurAnime cible={donnees.demandesCeMois} />
          </div>
          <div className="kpi-label">Déposées ce mois-ci</div>
          <div className="kpi-footer-hint">Voir ce mois →</div>
        </div>

        <div
          className="card kpi kpi-interactive"
          onClick={() => navigate('/demandes?statut=DEVIS_EMIS')}
          onKeyDown={(e) => activerClavier(e, () => navigate('/demandes?statut=DEVIS_EMIS'))}
          role="button"
          tabIndex={0}
          title="Voir les devis en attente de paiement"
        >
          <div className="kpi-valeur" style={{ color: 'var(--color-accent)' }}>
            <CompteurAnime cible={donnees.enAttentePaiement.total} />
          </div>
          <div className="kpi-label">Devis impayés</div>
          <div style={{ fontSize: 12, color: 'var(--color-accent)', marginTop: 4, fontWeight: 600 }}>
            {Number(donnees.enAttentePaiement.montant_total || 0).toLocaleString('fr-DZ')} DA
          </div>
        </div>

        <div
          className="card kpi kpi-interactive"
          onClick={() => navigate('/demandes?statut=TRAVAUX_TERMINES')}
          onKeyDown={(e) => activerClavier(e, () => navigate('/demandes?statut=TRAVAUX_TERMINES'))}
          role="button"
          tabIndex={0}
          title="Délai moyen constaté de réalisation"
        >
          <div className="kpi-valeur">
            <CompteurAnime cible={Math.round(donnees.delaiMoyenJours)} suffixe=" j" />
          </div>
          <div className="kpi-label">Délai moyen dépôt → travaux terminés</div>
          <div className="kpi-footer-hint">Historique global →</div>
        </div>
      </div>

      {/* Répartition interactive par étape du pipeline */}
      <div className="card" style={{ padding: 24, marginTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h3 style={{ fontSize: 17 }}>Répartition par étape du pipeline</h3>
            <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginTop: 2 }}>
              Cliquez sur une étape pour filtrer instantanément les demandes correspondantes
            </p>
          </div>
        </div>

        <div className="repartition-pipeline">
          {donnees.parStatut
            .filter((s) => ETAPES_PIPELINE.some((e) => e.code === s.code_statut))
            .map((s) => {
              const pourcentage = total > 0 ? Math.round((s.total / total) * 100) : 0;
              return (
                <div
                  key={s.code_statut}
                  className="repartition-ligne repartition-interactive"
                  onClick={() => navigate(`/demandes?statut=${s.code_statut}`)}
                  onKeyDown={(e) => activerClavier(e, () => navigate(`/demandes?statut=${s.code_statut}`))}
                  title={`Filtrer par ${s.libelle} (${s.total} demande${s.total > 1 ? 's' : ''})`}
                  role="button"
                  tabIndex={0}
                >
                  <span className="repartition-label">{s.libelle}</span>
                  <div className="repartition-barre-fond">
                    <div
                      className="repartition-barre"
                      style={{ width: `${(s.total / maxTotal) * 100}%` }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                    <span className="repartition-total mono">{s.total}</span>
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>({pourcentage}%)</span>
                  </div>
                </div>
              );
            })}
        </div>

        {/* Demandes rejetées / annulées */}
        <div style={{ display: 'flex', gap: 20, marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
          {donnees.parStatut
            .filter((s) => ['REJETEE', 'ANNULEE'].includes(s.code_statut))
            .map((s) => (
              <div
                key={s.code_statut}
                className="badge-terminal-clickable"
                onClick={() => navigate(`/demandes?statut=${s.code_statut}`)}
                onKeyDown={(e) => activerClavier(e, () => navigate(`/demandes?statut=${s.code_statut}`))}
                role="button"
                tabIndex={0}
                title={`Voir les demandes ${s.libelle.toLowerCase()}`}
              >
                <span>{s.code_statut === 'REJETEE' ? '⛔' : '🚫'}</span>
                <span>{s.libelle} :</span>
                <strong className="mono">{s.total}</strong>
                <span className="badge-terminal-arrow">→</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
