import { useEffect, useState } from 'react';
import client from '../../api/client';
import { notifierErreur, notifierSucces } from '../../utils/notifications';
import InputDate from '../InputDate';
import './PanneauDevis.css';

export default function PanneauDevis({ idDemande, devis, etude, demandeVerrouillee = false, onEnregistre }) {
  const devisListe = Array.isArray(devis) ? devis : (devis ? [devis] : []);
  const etudeRenseignee = Boolean(
    etude && (
      etude.date_visite ||
      etude.faisabilite ||
      (etude.distance_reseau_m !== null && etude.distance_reseau_m !== undefined) ||
      etude.diametre_conduite ||
      etude.observations
    )
  );
  const [devisSelectionne, setDevisSelectionne] = useState(null);
  const [ouvert, setOuvert] = useState(false);
  const [form, setForm] = useState({
    montant: ''
  });
  const [paiement, setPaiement] = useState({
    mode_paiement: 'Especes',
    date_paiement: new Date().toISOString().slice(0, 10),
    numero_recu: '',
    numero_cheque: '',
    numero_versement: '',
    banque: ''
  });
  const [envoi, setEnvoi] = useState(false);
  const [banques, setBanques] = useState([]);

  const [enregistrerPaiement, setEnregistrerPaiement] = useState(false);
  const [numeroDevisPreview, setNumeroDevisPreview] = useState('');

  const devisActuel = devisListe.find((item) => item.id_devis === devisSelectionne) || null;
  const montantTotalCumule = devisListe.reduce((acc, curr) => acc + (Number(curr.montant) || 0), 0);

  useEffect(() => {
    client.get('/referentiels/banques').then((res) => setBanques(res.data)).catch(() => setBanques([]));
  }, []);

  useEffect(() => {
    if (!ouvert || devisActuel || !idDemande) {
      setNumeroDevisPreview(devisActuel?.numero_devis || '');
      return;
    }

    let ignore = false;
    client.get(`/demandes/${idDemande}/devis/preview`)
      .then((res) => {
        if (!ignore) setNumeroDevisPreview(res.data.numero_devis || '');
      })
      .catch(() => {
        if (!ignore) setNumeroDevisPreview('');
      });

    return () => {
      ignore = true;
    };
  }, [ouvert, devisActuel, idDemande]);

  useEffect(() => {
    if (!devisActuel) {
      setForm({ montant: '' });
      setEnregistrerPaiement(false);
      setPaiement({
        mode_paiement: 'Especes',
        date_paiement: new Date().toISOString().slice(0, 10),
        numero_recu: '',
        numero_cheque: '',
        numero_versement: '',
        banque: ''
      });
      return;
    }
    setForm({ montant: devisActuel.montant || '' });
    setEnregistrerPaiement(devisActuel.statut_paiement === 'PAYE');
    setPaiement({
      mode_paiement: devisActuel.mode_paiement === 'Virement' ? 'Versement_bancaire' : (devisActuel.mode_paiement || 'Especes'),
      date_paiement: devisActuel.date_paiement?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      numero_recu: devisActuel.numero_recu || '',
      numero_cheque: devisActuel.numero_cheque || '',
      numero_versement: devisActuel.numero_versement || '',
      banque: devisActuel.banque?.toUpperCase() || ''
    });
  }, [devisActuel, ouvert]);

  function ouvrirAjoutDevisComplementaire() {
    if (demandeVerrouillee) {
      notifierErreur('Cette demande est scellée : les modifications sont interdites.');
      return;
    }
    if (!etudeRenseignee) {
      notifierErreur("L'étude technique doit être renseignée avant d'émettre un devis.");
      return;
    }
    setDevisSelectionne(null);
    setForm({ montant: '' });
    setEnregistrerPaiement(false);
    setOuvert(true);
  }

  function ouvrirModification(item) {
    if (demandeVerrouillee) {
      notifierErreur('Cette demande est scellée : les modifications sont interdites.');
      return;
    }
    setDevisSelectionne(item.id_devis);
    setOuvert(true);
  }

  async function enregistrer(e) {
    e.preventDefault();
    if (demandeVerrouillee) {
      await notifierErreur('Cette demande est scellée : les modifications sont interdites.');
      return;
    }
    if (!devisActuel && !etudeRenseignee) {
      await notifierErreur("L'étude technique doit être renseignée avant d'émettre un devis.");
      return;
    }
    if (devisActuel?.statut_paiement === 'PAYE' && Number(form.montant) !== Number(devisActuel.montant)) {
      await notifierErreur('Le montant d’un devis réglé ne peut pas être modifié.');
      return;
    }
    if (enregistrerPaiement && devisActuel?.date_emission && paiement.date_paiement < devisActuel.date_emission?.slice(0, 10)) {
      await notifierErreur('La date de paiement doit être supérieure ou égale à la date d’émission du devis.');
      return;
    }
    setEnvoi(true);
    try {
      const resDevis = await client.put(`/demandes/${idDemande}/devis`, {
        montant: form.montant,
        id_devis: devisActuel?.id_devis
      });

      const idDevisEnregistre = devisActuel?.id_devis || resDevis.data?.id_devis;

      if (enregistrerPaiement && idDevisEnregistre) {
        await client.patch(`/demandes/${idDemande}/devis/paiement`, {
          ...paiement,
          id_devis: idDevisEnregistre
        });
      }

      setOuvert(false);
      setDevisSelectionne(null);
      onEnregistre();
      await notifierSucces(
        devisActuel
          ? 'Devis mis à jour avec succès.'
          : devisListe.length > 0
            ? 'Devis complémentaire ajouté avec succès.'
            : 'Devis initial enregistré avec succès.'
      );
    } catch (err) {
      notifierErreur(err.response?.data?.erreur || "Erreur lors de l'enregistrement du devis.");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="card panneau-devis">
      {/* En-tête principal du panneau */}
      <div className="panneau-devis-header">
        <div className="panneau-devis-titre-wrap">
          <div className="panneau-devis-icon">💳</div>
          <div>
            <h3 style={{ margin: 0 }}>Devis & Paiement</h3>
            {devisListe.length > 0 && (
              <div className="panneau-devis-total-badge">
                <span>{devisListe.length} {devisListe.length > 1 ? 'devis enregistrés' : 'devis enregistré'}</span>
                <span>•</span>
                <span>Total : <span className="panneau-devis-total-valeur">{montantTotalCumule.toLocaleString('fr-DZ')} DA</span></span>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!demandeVerrouillee && devisListe.length > 0 && !ouvert && (
            <button type="button" className="btn btn-primary" onClick={ouvrirAjoutDevisComplementaire}>
              <span>+</span> Devis complémentaire
            </button>
          )}
          {!demandeVerrouillee && devisListe.length === 0 && !ouvert && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={!etudeRenseignee}
              style={{ opacity: etudeRenseignee ? 1 : 0.6 }}
              onClick={() => {
                if (!etudeRenseignee) {
                  notifierErreur("L'étude technique doit être renseignée avant d'émettre un devis.");
                  return;
                }
                setDevisSelectionne(null);
                setOuvert(true);
              }}
            >
              <span>✎</span> Émettre un devis
            </button>
          )}
          {ouvert && (
            <button type="button" className="btn btn-secondary" onClick={() => { setOuvert(false); setDevisSelectionne(null); }}>
              ✕ Fermer
            </button>
          )}
        </div>
      </div>

      {/* Liste des devis émis */}
      {!ouvert && (
        <div className="devis-liste-container">
          {devisListe.map((item, index) => {
            const estPaye = item.statut_paiement === 'PAYE';
            return (
              <div className="devis-card-item" key={item.id_devis}>
                <div className="devis-card-left">
                  <span className={`devis-type-tag ${index === 0 ? 'initial' : 'complementaire'}`}>
                    {index === 0 ? 'Devis initial' : `Complémentaire N°${index}`}
                  </span>
                  <div className="devis-numero-box">
                    <span className="devis-numero-libelle">Référence</span>
                    <span className="mono devis-numero-valeur">{item.numero_devis}</span>
                  </div>
                </div>

                <div className="devis-card-montant">
                  <span className="devis-numero-libelle">Montant</span>
                  <span className="devis-montant-chiffre">{Number(item.montant).toLocaleString('fr-DZ')} DA</span>
                </div>

                {item.date_emission && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span className="devis-numero-libelle">Émis le</span>
                    <span style={{ fontSize: 13.5, color: 'var(--color-text)' }}>
                      {new Date(item.date_emission).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                )}

                <div>
                  <span className={`devis-statut-pill ${estPaye ? 'paye' : 'impaye'}`}>
                    {estPaye ? '✓ Réglé' : '⏳ Impayé'}
                    {estPaye && item.date_paiement && (
                      <span style={{ opacity: 0.8, fontSize: 11 }}>
                        ({new Date(item.date_paiement).toLocaleDateString('fr-FR')})
                      </span>
                    )}
                  </span>
                </div>

                <div className="devis-card-actions">
                  {!demandeVerrouillee && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => ouvrirModification(item)}
                      title="Modifier ou encaisser ce devis"
                    >
                      <span>✎</span> {estPaye ? 'Modifier' : 'Régler / Modifier'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {devisListe.length === 0 && (
            <div className="devis-empty-state">
              <div className="devis-empty-icon">📑</div>
              <div className="devis-empty-text">
                {demandeVerrouillee
                  ? 'Demande scellée — aucune modification de devis n’est autorisée.'
                  : 'Aucun devis n\'a encore été émis pour ce dossier.'}
              </div>
              {!demandeVerrouillee && (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!etudeRenseignee}
                  style={{ opacity: etudeRenseignee ? 1 : 0.6 }}
                  onClick={() => {
                    if (!etudeRenseignee) {
                      notifierErreur("L'étude technique doit être renseignée avant d'émettre un devis.");
                      return;
                    }
                    setDevisSelectionne(null);
                    setOuvert(true);
                  }}
                >
                  + Émettre le premier devis
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Formulaire de création / modification */}
      {ouvert && (
        <form onSubmit={enregistrer} className="form-devis-container">
          <div className="form-devis-entete">
            <h4>
              <span>{devisActuel ? '✎' : devisListe.length > 0 ? '➕' : '📄'}</span>
              {devisActuel
                ? `Modifier le devis (${devisActuel.numero_devis})`
                : devisListe.length > 0
                  ? 'Ajout d’un devis complémentaire'
                  : 'Émission du devis initial'}
            </h4>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '4px 10px', fontSize: 12 }}
              onClick={() => { setOuvert(false); setDevisSelectionne(null); }}
            >
              Annuler
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            <div className="champ" style={{ margin: 0 }}>
              <label>N° DE DEVIS</label>
              <div
                className="mono"
                style={{
                  minHeight: 40,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 12px',
                  background: 'var(--color-surface-sunken)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 600,
                  color: 'var(--color-text)'
                }}
              >
                {devisActuel?.numero_devis || numeroDevisPreview || 'Sera généré automatiquement'}
              </div>
            </div>

            <div className="champ" style={{ margin: 0 }}>
              <label>MONTANT DU DEVIS (DA) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="ex: 45 000.00"
                value={form.montant}
                onChange={(e) => setForm({ ...form, montant: e.target.value })}
                disabled={devisActuel?.statut_paiement === 'PAYE'}
                title={devisActuel?.statut_paiement === 'PAYE' ? 'Le montant d’un devis réglé ne peut pas être modifié.' : undefined}
                style={{ fontSize: 15, fontWeight: 600, opacity: devisActuel?.statut_paiement === 'PAYE' ? 0.7 : 1 }}
              />
            </div>
          </div>

          {/* Section carte interactive pour l'encaissement / paiement */}
          <div className={`paiement-toggle-card ${enregistrerPaiement ? 'actif' : ''}`}>
            <label
              htmlFor="enregistrer-paiement"
              className="paiement-toggle-header"
            >
              <div className="paiement-toggle-left">
                <div className="paiement-toggle-icon">
                  {enregistrerPaiement ? '✅' : '💳'}
                </div>
                <div className="paiement-toggle-text">
                  <span className="paiement-toggle-titre">
                    Enregistrer le règlement de ce devis
                  </span>
                  <span className="paiement-toggle-description">
                    Activez cette option pour consigner immédiatement le paiement (espèces, chèque ou virement)
                  </span>
                </div>
              </div>

              <div className="custom-switch">
                <input
                  type="checkbox"
                  id="enregistrer-paiement"
                  checked={enregistrerPaiement}
                  onChange={(e) => setEnregistrerPaiement(e.target.checked)}
                />
                <span className="custom-switch-slider"></span>
              </div>
            </label>

            {/* Détails du paiement si le switch est activé */}
            {enregistrerPaiement && (
              <div className="paiement-details-content">
                <div className="champ">
                  <label id="mode-paiement-label">MODE DE RÈGLEMENT *</label>
                  <div className="mode-paiement-badges" role="radiogroup" aria-labelledby="mode-paiement-label">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={paiement.mode_paiement === 'Especes'}
                      className={`mode-paiement-btn ${paiement.mode_paiement === 'Especes' ? 'selectionne' : ''}`}
                      onClick={() => setPaiement({ ...paiement, mode_paiement: 'Especes' })}
                    >
                      <span aria-hidden="true">💵</span> Espèces
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={paiement.mode_paiement === 'Cheque'}
                      className={`mode-paiement-btn ${paiement.mode_paiement === 'Cheque' ? 'selectionne' : ''}`}
                      onClick={() => setPaiement({ ...paiement, mode_paiement: 'Cheque' })}
                    >
                      <span aria-hidden="true">🧾</span> Chèque
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={paiement.mode_paiement === 'Versement_bancaire'}
                      className={`mode-paiement-btn ${paiement.mode_paiement === 'Versement_bancaire' ? 'selectionne' : ''}`}
                      onClick={() => setPaiement({ ...paiement, mode_paiement: 'Versement_bancaire' })}
                    >
                      <span aria-hidden="true">🏦</span> Versement bancaire
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                  <div className="champ" style={{ margin: 0 }}>
                    <label>DATE DU PAIEMENT *</label>
                    <InputDate
                      required
                      min={devisActuel?.date_emission?.slice(0, 10)}
                      value={paiement.date_paiement}
                      onChange={(val) => setPaiement({ ...paiement, date_paiement: val })}
                    />
                  </div>

                  {paiement.mode_paiement === 'Especes' && (
                    <div className="champ" style={{ margin: 0 }}>
                      <label>N° DE REÇU DE CAISSE *</label>
                      <input
                        required
                        value={paiement.numero_recu}
                        onChange={(e) => setPaiement({ ...paiement, numero_recu: e.target.value })}
                        placeholder="ex: REC-2026-00123"
                      />
                    </div>
                  )}

                  {paiement.mode_paiement === 'Cheque' && (
                    <>
                      <div className="champ" style={{ margin: 0 }}>
                        <label>N° DE CHÈQUE *</label>
                        <input
                          required
                          value={paiement.numero_cheque}
                          onChange={(e) => setPaiement({ ...paiement, numero_cheque: e.target.value })}
                          placeholder="ex: CHQ-889900"
                        />
                      </div>
                      <div className="champ" style={{ margin: 0 }}>
                        <label>BANQUE ÉMETTRICE *</label>
                        <input
                          required
                          list="banques-enregistrees"
                          value={paiement.banque}
                          onChange={(e) => setPaiement({ ...paiement, banque: e.target.value.toUpperCase() })}
                          style={{ textTransform: 'uppercase' }}
                          placeholder="ex: BNA, BEA, CPA, BDL..."
                        />
                      </div>
                    </>
                  )}

                  {paiement.mode_paiement === 'Versement_bancaire' && (
                    <>
                      <div className="champ" style={{ margin: 0 }}>
                        <label>N° DE BORDEREAU / VERSEMENT *</label>
                        <input
                          required
                          value={paiement.numero_versement}
                          onChange={(e) => setPaiement({ ...paiement, numero_versement: e.target.value })}
                          placeholder="ex: VRS-554433"
                        />
                      </div>
                      <div className="champ" style={{ margin: 0 }}>
                        <label>BANQUE / CCP *</label>
                        <input
                          required
                          list="banques-enregistrees"
                          value={paiement.banque}
                          onChange={(e) => setPaiement({ ...paiement, banque: e.target.value.toUpperCase() })}
                          style={{ textTransform: 'uppercase' }}
                          placeholder="ex: BNA, CPA, ALGERIE POSTE..."
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Boutons d'action du formulaire */}
          <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={envoi}
              onClick={() => { setOuvert(false); setDevisSelectionne(null); }}
            >
              Annuler
            </button>
            <button type="submit" className="btn btn-primary" disabled={envoi}>
              <span>{envoi ? '⏳' : '✓'}</span>
              {envoi
                ? 'Enregistrement...'
                : devisActuel
                  ? (enregistrerPaiement && devisActuel.statut_paiement !== 'PAYE' ? 'Enregistrer & Valider le paiement' : 'Mettre à jour le devis')
                  : (enregistrerPaiement ? 'Enregistrer le devis & son paiement' : 'Enregistrer le devis')}
            </button>
          </div>
        </form>
      )}

      <datalist id="banques-enregistrees">
        {banques.map((banque) => <option key={banque} value={banque} />)}
      </datalist>
    </div>
  );
}


