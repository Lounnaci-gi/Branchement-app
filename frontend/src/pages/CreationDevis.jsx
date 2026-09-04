import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import client from '../api/client';
import EditeurDevisObat from '../components/devis/EditeurDevisObat';
import { notifierErreur, notifierSucces } from '../utils/notifications';

export default function CreationDevis() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const idDevisAEditer = searchParams.get('id_devis');
  const navigate = useNavigate();

  const [fiche, setFiche] = useState(null);
  const [articleFamilles, setArticleFamilles] = useState([]);
  const [numeroDevisPreview, setNumeroDevisPreview] = useState('');
  const [chargement, setChargement] = useState(true);
  const [sauvegardeEnCours, setSauvegardeEnCours] = useState(false);

  useEffect(() => {
    let ignore = false;
    setChargement(true);

    Promise.all([
      client.get(`/demandes/${id}`).catch((err) => {
        notifierErreur(err.response?.data?.erreur || 'Impossible de charger le dossier.');
        return null;
      }),
      client.get('/referentiels/articles').catch(() => ({ data: [] })),
      client.get(`/demandes/${id}/devis/preview`).catch(() => ({ data: {} }))
    ])
      .then(([resFiche, resArticles, resPreview]) => {
        if (ignore) return;
        if (resFiche?.data) {
          setFiche(resFiche.data);
        }
        if (Array.isArray(resArticles?.data)) {
          setArticleFamilles(resArticles.data);
        }
        if (resPreview?.data?.numero_devis) {
          setNumeroDevisPreview(resPreview.data.numero_devis);
        }
      })
      .finally(() => {
        if (!ignore) setChargement(false);
      });

    return () => {
      ignore = true;
    };
  }, [id]);

  if (chargement) {
    return (
      <div className="page" aria-busy="true" style={{ padding: 40, textAlign: 'center' }}>
        <div className="squelette squelette-titre" style={{ width: 240, margin: '0 auto 20px' }} />
        <p style={{ color: 'var(--color-text-muted)' }}>Chargement de l’éditeur de devis…</p>
      </div>
    );
  }

  if (!fiche) {
    return (
      <div className="page etat-erreur" role="alert" style={{ padding: 40, textAlign: 'center' }}>
        <h1>Dossier introuvable</h1>
        <p>Le dossier demandé n’existe pas ou a été déplacé.</p>
        <Link to="/demandes" className="btn btn-primary" style={{ marginTop: 16 }}>
          Retour aux demandes
        </Link>
      </div>
    );
  }

  const { demande, etude, devis = [] } = fiche;
  const demandeVerrouillee =
    demande.est_verrouillee === true || demande.est_verrouillee === 1 || demande.est_verrouillee === '1';

  const devisAEditer = idDevisAEditer
    ? devis.find((d) => String(d.id_devis) === String(idDevisAEditer))
    : null;

  async function enregistrerDevis(payload, estFinalisation = false) {
    if (demandeVerrouillee) {
      notifierErreur('Cette demande est scellée : les modifications sont interdites.');
      return;
    }

    if (!payload.articles || payload.articles.length === 0) {
      notifierErreur('Veuillez insérer au moins un article dans le devis.');
      return;
    }

    if (!payload.montant || payload.montant <= 0) {
      notifierErreur('Le montant total du devis doit être supérieur à 0.');
      return;
    }

    setSauvegardeEnCours(true);
    try {
      const res = await client.put(`/demandes/${id}/devis`, {
        id_devis: devisAEditer?.id_devis,
        montant: payload.montant,
        articles: payload.articles
      });

      const idDevisCree = devisAEditer?.id_devis || res.data?.id_devis;

      if (payload.paiementDirect && idDevisCree) {
        await client.patch(`/demandes/${id}/devis/paiement`, {
          ...payload.paiementDirect,
          id_devis: idDevisCree
        });
      }

      await notifierSucces(
        estFinalisation
          ? 'Devis finalisé et enregistré avec succès !'
          : 'Devis enregistré avec succès !'
      );
      navigate(`/demandes/${id}`);
    } catch (err) {
      notifierErreur(err.response?.data?.erreur || "Erreur lors de l'enregistrement du devis.");
    } finally {
      setSauvegardeEnCours(false);
    }
  }

  return (
    <div style={{ margin: '-24px', position: 'relative' }}>
      <EditeurDevisObat
        demande={demande}
        etude={etude}
        devisInitial={devisAEditer}
        articleFamilles={articleFamilles}
        numeroDevisPreview={numeroDevisPreview}
        chargement={sauvegardeEnCours}
        onEnregistrer={(payload) => enregistrerDevis(payload, false)}
        onFinaliser={(payload) => enregistrerDevis(payload, true)}
        onAnnule={() => navigate(`/demandes/${id}`)}
      />
    </div>
  );
}
