import { useEffect, useState } from 'react';
import client from '../../api/client';
import { notifierErreur, notifierSucces } from '../../utils/notifications';
import { imprimerOrdreExecution } from '../../utils/impressionOrdreExecution';
import { imprimerContratAbonnement } from '../../utils/impressionContratAbonnement';
import InputDate from '../InputDate';

const DIAMETRES_STANDARD = ['15mm', '20mm', '25mm', '32mm', '40mm', '50mm', '63mm', '80mm', '100mm', '110mm', '125mm', '150mm', '200mm'];
const MARQUES_STANDARD = ['Sensus', 'Itron', 'Maddalena', 'Schlumberger', 'Elster', 'Landis+Gyr', 'Zenner', 'Aquameter', 'Kaifa', 'Other'];

export default function PanneauTravaux({ idDemande, demande, travaux, devis, etude, miseEnService, demandeVerrouillee = false, onEnregistre }) {
  const devisListe = Array.isArray(devis) ? devis : (devis ? [devis] : []);
  const devisPaye = devisListe.length > 0 && devisListe.every((item) => item.statut_paiement === 'PAYE');
  const [marquesDisponibles, setMarquesDisponibles] = useState([...MARQUES_STANDARD]);

  // Date de paiement la plus récente parmi tous les devis payés
  const dateMinDebut = (() => {
    const dates = devisListe
      .filter((d) => d.date_paiement)
      .map((d) => d.date_paiement.slice(0, 10));
    if (dates.length === 0) return '';
    return dates.sort().at(-1); // la plus récente
  })();

  const [ouvert, setOuvert] = useState(false);
  const [form, setForm] = useState({
    date_debut: travaux?.date_debut?.slice(0, 10) || '',
    date_fin: travaux?.date_fin?.slice(0, 10) || '',
    equipe_execution: travaux?.equipe_execution || '',
    numero_compteur: travaux?.numero_compteur || '',
    marque_compteur: travaux?.marque_compteur || 'Sensus',
    type_compteur: travaux?.type_compteur || '',
    diametre_compteur: travaux?.diametre_compteur || '',
    observations: travaux?.observations || ''
  });
  const [envoi, setEnvoi] = useState(false);

  function initialiserFormulaire(source = travaux) {
    setForm({
      date_debut: source?.date_debut?.slice(0, 10) || '',
      date_fin: source?.date_fin?.slice(0, 10) || '',
      equipe_execution: source?.equipe_execution || '',
      numero_compteur: source?.numero_compteur || '',
      marque_compteur: source?.marque_compteur || 'Sensus',
      type_compteur: source?.type_compteur || '',
      diametre_compteur: source?.diametre_compteur || '',
      observations: source?.observations || ''
    });
  }

  useEffect(() => {
    initialiserFormulaire();
  }, [travaux]);

  useEffect(() => {
    client.get('/referentiels/marques-compteur')
      .then((res) => {
        const marquesServeur = Array.isArray(res.data) ? res.data.filter(Boolean) : [];
        const liste = [...new Set([...MARQUES_STANDARD, ...marquesServeur])];
        setMarquesDisponibles(liste);
      })
      .catch(() => setMarquesDisponibles(MARQUES_STANDARD));
  }, []);

  useEffect(() => {
    if (demandeVerrouillee) setOuvert(false);
  }, [demandeVerrouillee]);

  function ouvrirEdition() {
    if (demandeVerrouillee) {
      notifierErreur('Cette demande est scellée : les modifications sont interdites.');
      return;
    }
    initialiserFormulaire();
    setOuvert(true);
  }

  function handleImprimerContrat(travauxData = travaux) {
    imprimerContratAbonnement({
      ...demande,
      travaux: travauxData,
      devis,
      etude
    });
  }

  function handleImprimer(travauxData = travaux) {
    imprimerOrdreExecution({
      ...demande,
      travaux: travauxData,
      devis,
      etude,
      miseEnService
    });
  }

  // Formate yyyy-mm-dd → dd/mm/yyyy pour l'affichage
  function dateFr(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }

  async function enregistrer(e) {
    e.preventDefault();
    if (demandeVerrouillee) {
      await notifierErreur('Cette demande est scellée : les modifications sont interdites.');
      return;
    }
    if (!devisPaye) {
      await notifierErreur(`Le devis doit être payé avant de renseigner l'exécution des travaux.`);
      return;
    }
    // Validation : date de début >= date de paiement du devis (à partir de la date de paiement)
    if (form.date_debut && dateMinDebut && form.date_debut < dateMinDebut) {
      await notifierErreur(`La date de début (${dateFr(form.date_debut)}) ne peut pas être antérieure à la date de paiement du devis (${dateFr(dateMinDebut)}).`);
      return;
    }
    // Validation : date de fin >= date de début
    if (form.date_fin && form.date_debut && form.date_fin < form.date_debut) {
      await notifierErreur(`La date de fin (${dateFr(form.date_fin)}) doit être supérieure ou égale à la date de début (${dateFr(form.date_debut)}).`);
      return;
    }
    setEnvoi(true);
    const fenetreContrat = form.date_fin ? window.open('', '_blank', 'width=900,height=1000') : null;
    let contratImprime = false;
    try {
      const res = await client.put(`/demandes/${idDemande}/travaux`, form);
      setOuvert(false);
      if (form.date_fin) {
        imprimerContratAbonnement({
          ...demande,
          travaux: {
            ...form,
            numero_ordre_execution: res.data?.numero_ordre_execution || travaux?.numero_ordre_execution || ''
          },
          devis,
          etude
        }, fenetreContrat);
        contratImprime = true;
        notifierSucces('Exécution des travaux enregistrée. Impression du contrat d’abonnement…');
      } else {
        notifierSucces('Exécution des travaux enregistrée.');
      }
      onEnregistre();
    } catch (err) {
      notifierErreur(err.response?.data?.erreur || "Erreur lors de l'enregistrement des travaux.");
    } finally {
      if (!contratImprime && fenetreContrat && !fenetreContrat.closed) fenetreContrat.close();
      setEnvoi(false);
    }
  }


  const travauxTermines = Boolean(travaux?.date_fin || form.date_fin);

  return (
    <div className="card" style={{ padding: 24 }}>
      <div className="panneau-entete">
        <h3>Exécution des travaux</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!ouvert && travaux && (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleImprimer(travaux || form)}
                title="Imprimer l'ordre d'exécution"
              >
                <span>🖨</span> Imprimer ordre d'exécution
              </button>
              {travauxTermines && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => handleImprimerContrat(travaux || form)}
                  title="Imprimer le contrat d'abonnement"
                >
                  <span>🖨</span> Contrat d'abonnement
                </button>
              )}
            </>
          )}
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!devisPaye || demandeVerrouillee}
            onClick={ouvrirEdition}
            aria-expanded={ouvert}
            aria-controls="panneau-travaux-form"
            title={
              demandeVerrouillee
                ? 'Impossible de modifier les travaux : la demande est scellée.'
                : !devisPaye
                  ? 'Le devis doit être payé avant de renseigner les travaux.'
                  : undefined
            }
          >
            {demandeVerrouillee ? 'Demande scellée' : travaux ? 'Modifier' : 'Renseigner'}
          </button>
        </div>
      </div>

      {!devisPaye && <p style={{ color: 'var(--color-text-muted)', marginTop: 12 }}>Le devis doit être payé avant de renseigner l’exécution des travaux.</p>}
      {!ouvert && travaux && (
        <div className="grille-info" style={{ marginTop: 16 }}>
          <div><span className="info-label">Ordre d'exécution</span><div className="mono">{travaux.numero_ordre_execution || '—'}</div></div>
          <div><span className="info-label">Début</span><div>{travaux.date_debut ? new Date(travaux.date_debut).toLocaleDateString('fr-FR') : '—'}</div></div>
          <div><span className="info-label">Fin</span><div>{travaux.date_fin ? new Date(travaux.date_fin).toLocaleDateString('fr-FR') : '—'}</div></div>
          <div><span className="info-label">Équipe</span><div>{travaux.equipe_execution || '—'}</div></div>
          <div><span className="info-label">N° compteur posé</span><div className="mono">{travaux.numero_compteur || '—'}</div></div>
          <div><span className="info-label">Marque compteur</span><div>{travaux.marque_compteur || '—'}</div></div>
          <div><span className="info-label">Type compteur</span><div>{travaux.type_compteur || '—'}</div></div>
          <div><span className="info-label">Diamètre compteur</span><div>{travaux.diametre_compteur || '—'}</div></div>
        </div>
      )}
      {!ouvert && !travaux && <p style={{ color: 'var(--color-text-muted)', marginTop: 12 }}>Travaux non encore renseignés.</p>}

      {ouvert && (
        <form id="panneau-travaux-form" onSubmit={enregistrer} style={{ marginTop: 16 }}>
          <div className="form-grille-2">
            <div className="champ">
              <label>
                Date de début
                {dateMinDebut && <span style={{ fontWeight: 'normal', color: 'var(--color-text-muted)', fontSize: '0.85em', marginLeft: 6 }}>
                  (à partir du {dateFr(dateMinDebut)})
                </span>}
              </label>
              <InputDate
                value={form.date_debut}
                min={dateMinDebut || undefined}
                onChange={(val) => setForm({ ...form, date_debut: val })}
              />
            </div>
            <div className="champ">
              <label>Date de fin</label>
              <InputDate
                value={form.date_fin}
                min={form.date_debut || dateMinDebut || undefined}
                onChange={(val) => setForm({ ...form, date_fin: val })}
              />
            </div>
            <div className="champ">
              <label>Équipe d'exécution</label>
              <input value={form.equipe_execution} onChange={(e) => setForm({ ...form, equipe_execution: e.target.value })} />
            </div>
            <div className="champ">
              <label>N° compteur posé</label>
              <input value={form.numero_compteur} onChange={(e) => setForm({ ...form, numero_compteur: e.target.value })} />
            </div>
            <div className="champ">
              <label>Marque compteur</label>
              <input
                list="marques-standard"
                value={form.marque_compteur}
                onChange={(e) => setForm({ ...form, marque_compteur: e.target.value })}
                placeholder="ex: Sensus, Itron…"
              />
              <datalist id="marques-standard">
                {marquesDisponibles.map((marque) => (
                  <option key={marque} value={marque} />
                ))}
              </datalist>
            </div>
            <div className="champ">
              <label>Type compteur</label>
              <input
                value={form.type_compteur}
                onChange={(e) => setForm({ ...form, type_compteur: e.target.value })}
                placeholder="ex: volumétrique, à turbine…"
              />
            </div>
            <div className="champ">
              <label>Diamètre compteur</label>
              <input
                list="diametres-standard"
                value={form.diametre_compteur}
                onChange={(e) => setForm({ ...form, diametre_compteur: e.target.value })}
                placeholder="ex: 20mm"
              />
              <datalist id="diametres-standard">
                {DIAMETRES_STANDARD.map((diametre) => (
                  <option key={diametre} value={diametre} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="champ">
            <label>Observations</label>
            <textarea rows={2} value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} />
          </div>
          <button className="btn btn-primary" disabled={envoi}>{envoi ? 'Enregistrement...' : 'Enregistrer'}</button>
        </form>
      )}
    </div>
  );
}

