import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import client from '../api/client';
import Breadcrumbs from '../components/Breadcrumbs';
import PanneauDevis from '../components/panneaux/PanneauDevis';
import { notifierErreur } from '../utils/notifications';

export default function CreationDevis() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [fiche, setFiche] = useState(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    client.get(`/demandes/${id}`)
      .then((res) => setFiche(res.data))
      .catch((err) => notifierErreur(err.response?.data?.erreur || 'Impossible de charger le dossier.'))
      .finally(() => setChargement(false));
  }, [id]);

  if (chargement) {
    return <div className="page" aria-busy="true"><div className="squelette squelette-titre" /></div>;
  }

  if (!fiche) {
    return (
      <div className="page etat-erreur" role="alert">
        <h1>Dossier introuvable</h1>
        <Link to="/demandes" className="btn btn-primary">Retour aux demandes</Link>
      </div>
    );
  }

  const { demande, etude } = fiche;
  const demandeVerrouillee = demande.est_verrouillee === true || demande.est_verrouillee === 1 || demande.est_verrouillee === '1';

  return (
    <div className="page">
      <Breadcrumbs items={[
        { label: 'Demandes', path: '/demandes' },
        { label: demande.numero_demande, path: `/demandes/${id}` },
        { label: 'Nouveau devis', icon: '📄' }
      ]} />
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1>Créer un devis</h1>
          <p style={{ color: 'var(--color-text-muted)', marginTop: 4 }}>
            Devis pour {demande.est_personne_morale ? demande.raison_sociale : `${demande.demandeur_nom || ''} ${demande.demandeur_prenom || ''}`.trim()}
          </p>
        </div>
        <Link to={`/demandes/${id}`} className="btn btn-secondary">← Retour au dossier</Link>
      </div>
      <div className="creation-devis-layout">
        <PanneauDevis
          idDemande={id}
          demande={demande}
          devis={[]}
          etude={etude}
          demandeVerrouillee={demandeVerrouillee}
          ouvrirFormulaire
          formulaireUniquement
          afficherResumeDemande={false}
          masquerArticlesSelectionnes
          onEnregistre={() => navigate(`/demandes/${id}`)}
          onAnnule={() => navigate(`/demandes/${id}`)}
        />
        <aside className="creation-devis-abonne card">
          <div className="creation-devis-abonne-kicker">Dossier client</div>
          <h2>Informations de l’abonné</h2>
          <div className="creation-devis-info"><span>Nom / raison sociale</span><strong>{demande.est_personne_morale ? demande.raison_sociale : `${demande.demandeur_nom || ''} ${demande.demandeur_prenom || ''}`.trim() || '—'}</strong></div>
          <div className="creation-devis-info"><span>Téléphone</span><strong>{demande.telephone || demande.telephone_secondaire || '—'}</strong></div>
          <div className="creation-devis-info"><span>Adresse de résidence</span><strong>{demande.demandeur_adresse || '—'}</strong></div>
          <div className="creation-devis-info"><span>Lieu des travaux</span><strong>{demande.adresse_branchement || '—'}</strong><small>{demande.nom_commune || 'Commune non renseignée'}</small></div>
          <div className="creation-devis-info"><span>Nature des travaux</span><strong>{demande.type_autre || demande.type_branchement || 'Branchement d’eau potable'}</strong></div>
        </aside>
      </div>
      <style>{`.creation-devis-layout { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 20px; align-items: start; }
        .creation-devis-abonne { padding: 22px; position: sticky; top: 20px; }
        .creation-devis-abonne-kicker { color: var(--color-primary); font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
        .creation-devis-abonne h2 { margin: 5px 0 22px; font-size: 18px; }
        .creation-devis-info { display: flex; flex-direction: column; gap: 5px; padding: 13px 0; border-top: 1px solid var(--color-border); }
        .creation-devis-info span, .creation-devis-info small { color: var(--color-text-muted); font-size: 12px; }
        .creation-devis-info strong { line-height: 1.4; }
        @media (max-width: 900px) { .creation-devis-layout { grid-template-columns: 1fr; } .creation-devis-abonne { position: static; grid-row: 1; } }
      `}</style>
    </div>
  );
}
