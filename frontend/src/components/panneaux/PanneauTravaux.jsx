import { useEffect, useState } from 'react';
import client from '../../api/client';
import { notifierErreur, notifierSucces } from '../../utils/notifications';
import { imprimerOrdreExecution } from '../../utils/impressionOrdreExecution';
import InputDate from '../InputDate';

const DIAMETRES_STANDARD = ['15mm', '20mm', '25mm', '32mm', '40mm', '50mm', '63mm', '80mm', '100mm', '110mm', '125mm', '150mm', '200mm'];

export default function PanneauTravaux({ idDemande, demande, travaux, devis, etude, miseEnService, onEnregistre }) {
  const devisListe = Array.isArray(devis) ? devis : (devis ? [devis] : []);
  const devisPaye = devisListe.length > 0 && devisListe.every((item) => item.statut_paiement === 'PAYE');

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
    marque_compteur: travaux?.marque_compteur || '',
    type_compteur: travaux?.type_compteur || '',
    diametre_compteur: travaux?.diametre_compteur || '',
    observations: travaux?.observations || ''
  });
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    setForm({
      date_debut: travaux?.date_debut?.slice(0, 10) || '',
      date_fin: travaux?.date_fin?.slice(0, 10) || '',
      equipe_execution: travaux?.equipe_execution || '',
      numero_compteur: travaux?.numero_compteur || '',
      marque_compteur: travaux?.marque_compteur || '',
      type_compteur: travaux?.type_compteur || '',
      diametre_compteur: travaux?.diametre_compteur || '',
      observations: travaux?.observations || ''
    });
  }, [travaux]);

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
    try {
      const res = await client.put(`/demandes/${idDemande}/travaux`, form);
      const updatedTravaux = {
        ...travaux,
        ...form,
        numero_ordre_execution: res.data?.numero_ordre_execution || travaux?.numero_ordre_execution
      };
      setOuvert(false);
      notifierSucces('Exécution des travaux enregistrée.');
      onEnregistre();
      // Impression automatique immédiate de l'ordre d'exécution
      handleImprimer(updatedTravaux);
    } catch (err) {
      notifierErreur(err.response?.data?.erreur || "Erreur lors de l'enregistrement des travaux.");
    } finally {
      setEnvoi(false);
    }
  }


  return (
    <div className="card" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <h3>Exécution des travaux</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          {(travaux || devisPaye) && (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!devisPaye}
              onClick={() => handleImprimer(travaux || form)}
              title="Imprimer l'ordre d'exécution"
            >
              <span>🖨</span> Imprimer ordre d'exécution
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!devisPaye}
            onClick={() => setOuvert((o) => !o)}
            title={!devisPaye ? 'Le devis doit être payé avant de renseigner les travaux.' : undefined}
          >
            {travaux ? 'Modifier' : 'Renseigner'}
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
        <form onSubmit={enregistrer} style={{ marginTop: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
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
                value={form.marque_compteur}
                onChange={(e) => setForm({ ...form, marque_compteur: e.target.value })}
                placeholder="ex: Itron, Maddalena…"
              />
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
          <button className="btn btn-primary" disabled={envoi}>{envoi ? 'Enregistrement & impression...' : 'Enregistrer et imprimer l\'ordre'}</button>
        </form>
      )}
    </div>
  );
}

