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
    .filter((s) => ['TRAVAUX_EN_COURS', 'TRAVAUX_TERMINES', 'SCELLEE'].includes(s.code_statut))
    .reduce((total, s) => total + Number(s.total || 0), 0);

  const maxTotal = Math.max(...donnees.parStatut.map((s) => s.total), 1);

  return (
    <div className="page">
      <Breadcrumbs items={[{ label: 'Tableau de bord', icon: '📊' }]} />

      <header className="obat-page-header">
        <div>
          <span>ADE • SUIVI TECHNIQUE</span>
          <h1 className="obat-page-title">Tableau de bord de gestion</h1>
          <p className="obat-page-subtitle">
            Indicateurs d'activité, suivi des chantiers et pilotage du réseau de branchements en temps réel.
          </p>
        </div>
        <div className="obat-page-actions">
          <button
            type="button"
            className="obat-btn obat-btn-sec"
            onClick={actualiser}
            disabled={rafraichissement}
            title="Actualiser les données"
          >
            <span style={{ display: 'inline-block', transform: rafraichissement ? 'rotate(360deg)' : 'none', transition: 'transform 0.6s ease' }}>
              🔄
            </span>
            <span>Actualiser</span>
          </button>
          <Link to="/demandes/nouvelle" className="obat-btn obat-btn-pri">
            <span>✨</span> Nouvelle demande
          </Link>
        </div>
      </header>

      {/* Cartes KPI Obat avec icônes colorées */}
      <div className="obat-kpi-grid">
        <div
          className="obat-kpi-card"
          onClick={() => navigate('/demandes')}
          onKeyDown={(e) => activerClavier(e, () => navigate('/demandes'))}
          role="button"
          tabIndex={0}
          title="Voir toutes les demandes actives"
          style={{ cursor: 'pointer' }}
        >
          <div className="obat-kpi-icon blue">📋</div>
          <div>
            <div className="obat-kpi-value">
              <CompteurAnime cible={total} />
            </div>
            <div className="obat-kpi-label">Demandes actives</div>
          </div>
        </div>

        <div
          className="obat-kpi-card"
          onClick={() => navigate('/demandes?statut=TRAVAUX_TERMINES')}
          onKeyDown={(e) => activerClavier(e, () => navigate('/demandes?statut=TRAVAUX_TERMINES'))}
          role="button"
          tabIndex={0}
          title="Voir les demandes achevées"
          style={{ cursor: 'pointer' }}
        >
          <div className="obat-kpi-icon green">✅</div>
          <div>
            <div className="obat-kpi-value" style={{ color: 'var(--color-success)' }}>
              <CompteurAnime cible={demandesAchevees} />
            </div>
            <div className="obat-kpi-label">Demandes achevées</div>
          </div>
        </div>

        <div
          className="obat-kpi-card"
          onClick={() => navigate('/demandes')}
          onKeyDown={(e) => activerClavier(e, () => navigate('/demandes'))}
          role="button"
          tabIndex={0}
          title="Voir les demandes de ce mois"
          style={{ cursor: 'pointer' }}
        >
          <div className="obat-kpi-icon purple">📅</div>
          <div>
            <div className="obat-kpi-value">
              <CompteurAnime cible={donnees.demandesCeMois} />
            </div>
            <div className="obat-kpi-label">Déposées ce mois-ci</div>
          </div>
        </div>

        <div
          className="obat-kpi-card"
          onClick={() => navigate('/demandes?statut=DEVIS_EMIS')}
          onKeyDown={(e) => activerClavier(e, () => navigate('/demandes?statut=DEVIS_EMIS'))}
          role="button"
          tabIndex={0}
          title="Voir les devis en attente de paiement"
          style={{ cursor: 'pointer' }}
        >
          <div className="obat-kpi-icon amber">💳</div>
          <div>
            <div className="obat-kpi-value" style={{ color: 'var(--color-accent)' }}>
              <CompteurAnime cible={donnees.enAttentePaiement.total} />
            </div>
            <div className="obat-kpi-label">Devis impayés</div>
            <div style={{ fontSize: 11.5, color: 'var(--color-accent)', marginTop: 2, fontWeight: 700 }}>
              {Number(donnees.enAttentePaiement.montant_total || 0).toLocaleString('fr-DZ')} DA
            </div>
          </div>
        </div>

        <div
          className="obat-kpi-card"
          onClick={() => navigate('/demandes?statut=TRAVAUX_TERMINES')}
          onKeyDown={(e) => activerClavier(e, () => navigate('/demandes?statut=TRAVAUX_TERMINES'))}
          role="button"
          tabIndex={0}
          title="Délai moyen constaté de réalisation"
          style={{ cursor: 'pointer' }}
        >
          <div className="obat-kpi-icon cyan">⏱️</div>
          <div>
            <div className="obat-kpi-value">
              <CompteurAnime cible={Math.round(donnees.delaiMoyenJours)} suffixe=" j" />
            </div>
            <div className="obat-kpi-label">Délai moyen réalisation</div>
          </div>
        </div>
      </div>

      {/* Répartition interactive par étape du pipeline dans une carte Obat */}
      <div className="obat-section-card" style={{ marginTop: 20 }}>
        <div className="obat-section-card-header">
          <div className="obat-section-card-title">
            <span>📊</span> Répartition des dossiers par étape du pipeline
          </div>
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            Cliquez pour filtrer les demandes
          </span>
        </div>
        <div className="obat-section-card-body">
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
                className="repartition-terminal-link"
                onClick={() => navigate(`/demandes?statut=${s.code_statut}`)}
                onKeyDown={(e) => activerClavier(e, () => navigate(`/demandes?statut=${s.code_statut}`))}
                role="button"
                tabIndex={0}
                title={`Voir les demandes ${s.libelle.toLowerCase()}`}
              >
                <span>{s.code_statut === 'REJETEE' ? '⛔' : '🚫'}</span>
                <span>{s.libelle} :</span>
                <strong className="mono">{s.total}</strong>
                <span>→</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  </div>
  );
}
