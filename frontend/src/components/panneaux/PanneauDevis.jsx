import { useEffect, useState } from 'react';
import client from '../../api/client';
import { notifierErreur, notifierSucces } from '../../utils/notifications';

export default function PanneauDevis({ idDemande, devis, onEnregistre }) {
  const [ouvert, setOuvert] = useState(false);
  const [form, setForm] = useState({
    montant: devis?.montant || ''
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

  useEffect(() => {
    client.get('/referentiels/banques').then((res) => setBanques(res.data)).catch(() => setBanques([]));
  }, []);

  useEffect(() => {
    if (!ouvert || devis || !idDemande) {
      setNumeroDevisPreview(devis?.numero_devis || '');
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
  }, [ouvert, devis, idDemande]);

  useEffect(() => {
    if (!devis) return;
    setForm({ montant: devis.montant || '' });
    setEnregistrerPaiement(devis.statut_paiement === 'PAYE');
    setPaiement({
      mode_paiement: devis.mode_paiement === 'Virement' ? 'Versement_bancaire' : (devis.mode_paiement || 'Especes'),
      date_paiement: devis.date_paiement?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      numero_recu: devis.numero_recu || '',
      numero_cheque: devis.numero_cheque || '',
      numero_versement: devis.numero_versement || '',
      banque: devis.banque?.toUpperCase() || ''
    });
  }, [devis]);

  async function enregistrer(e) {
    e.preventDefault();
    setEnvoi(true);
    try {
      await client.put(`/demandes/${idDemande}/devis`, { montant: form.montant });
      if (devis && (enregistrerPaiement || devis.statut_paiement === 'PAYE')) {
        await client.patch(`/demandes/${idDemande}/devis/paiement`, paiement);
      }
      setOuvert(false);
      onEnregistre();
      await notifierSucces('Devis enregistré avec succès.');
    } catch (err) {
      notifierErreur(err.response?.data?.erreur || "Erreur lors de l'enregistrement du devis.");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="card" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Devis & paiement</h3>
        <button className="btn btn-secondary" onClick={() => setOuvert((o) => !o)}>
          {ouvert ? 'Fermer' : devis ? 'Modifier' : 'Émettre un devis'}
        </button>
      </div>

      {devis && !ouvert && (
        <div className="grille-info" style={{ marginTop: 16 }}>
          <div><span className="info-label">N° devis</span><div className="mono">{devis.numero_devis}</div></div>
          <div><span className="info-label">Montant</span><div>{Number(devis.montant).toLocaleString('fr-DZ')} DA</div></div>
          <div><span className="info-label">Statut paiement</span><div>{devis.statut_paiement === 'PAYE' ? '✅ Payé' : '⏳ Impayé'}</div></div>
          {devis.date_paiement && <div><span className="info-label">Payé le</span><div>{new Date(devis.date_paiement).toLocaleDateString('fr-FR')}</div></div>}
          {devis.mode_paiement && <div><span className="info-label">Mode de paiement</span><div>{devis.mode_paiement === 'Especes' ? 'Espèces' : devis.mode_paiement === 'Cheque' ? 'Chèque' : 'Versement bancaire'}</div></div>}
          {devis.numero_recu && <div><span className="info-label">N° reçu</span><div>{devis.numero_recu}</div></div>}
          {devis.numero_cheque && <div><span className="info-label">N° chèque</span><div>{devis.numero_cheque}</div></div>}
          {devis.numero_versement && <div><span className="info-label">N° versement</span><div>{devis.numero_versement}</div></div>}
          {devis.banque && <div><span className="info-label">Banque</span><div>{devis.banque}</div></div>}
        </div>
      )}

      {!ouvert && !devis && <p style={{ color: 'var(--color-text-muted)', marginTop: 12 }}>Aucun devis émis.</p>}

      {ouvert && (
        <form onSubmit={enregistrer} style={{ marginTop: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="champ">
              <label>N° devis</label>
              <div className="mono" style={{ minHeight: 38, display: 'flex', alignItems: 'center', padding: '0 10px', background: 'var(--color-surface-muted)', border: '1px solid var(--color-border)', borderRadius: 6 }}>
                {devis?.numero_devis || numeroDevisPreview || 'Sera généré lors de l’enregistrement'}
              </div>
            </div>
            <div className="champ">
              <label>Montant (DA) *</label>
              <input type="number" step="0.01" required value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} />
            </div>
          </div>

          {devis && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
              <div className="champ" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <input
                  type="checkbox"
                  id="enregistrer-paiement"
                  checked={enregistrerPaiement}
                  onChange={(e) => setEnregistrerPaiement(e.target.checked)}
                />
                <label htmlFor="enregistrer-paiement" style={{ margin: 0, cursor: 'pointer', fontWeight: 600 }}>
                  Enregistrer le paiement du devis
                </label>
              </div>

              {enregistrerPaiement && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="champ">
                    <label>Mode de paiement *</label>
                    <select value={paiement.mode_paiement} onChange={(e) => setPaiement({ ...paiement, mode_paiement: e.target.value })}>
                      <option value="Especes">Espèces</option>
                      <option value="Cheque">Chèque</option>
                      <option value="Versement_bancaire">Versement bancaire</option>
                    </select>
                  </div>
                  <div className="champ">
                    <label>Date de paiement *</label>
                    <input type="date" required value={paiement.date_paiement} onChange={(e) => setPaiement({ ...paiement, date_paiement: e.target.value })} />
                  </div>
                  {paiement.mode_paiement === 'Especes' && (
                    <div className="champ">
                      <label>N° reçu *</label>
                      <input required value={paiement.numero_recu} onChange={(e) => setPaiement({ ...paiement, numero_recu: e.target.value })} placeholder="ex: REC-00123" />
                    </div>
                  )}
                  {paiement.mode_paiement === 'Cheque' && (
                    <>
                      <div className="champ">
                        <label>N° chèque *</label>
                        <input required value={paiement.numero_cheque} onChange={(e) => setPaiement({ ...paiement, numero_cheque: e.target.value })} placeholder="ex: CHQ-998877" />
                      </div>
                      <div className="champ">
                        <label>Nom de la banque *</label>
                        <input required list="banques-enregistrees" value={paiement.banque} onChange={(e) => setPaiement({ ...paiement, banque: e.target.value.toUpperCase() })} style={{ textTransform: 'uppercase' }} placeholder="ex: BNA, BEA, CPA..." />
                      </div>
                    </>
                  )}
                  {paiement.mode_paiement === 'Versement_bancaire' && (
                    <>
                      <div className="champ">
                        <label>N° de versement *</label>
                        <input required value={paiement.numero_versement} onChange={(e) => setPaiement({ ...paiement, numero_versement: e.target.value })} placeholder="ex: VRS-554433" />
                      </div>
                      <div className="champ">
                        <label>Nom de la banque *</label>
                        <input required list="banques-enregistrees" value={paiement.banque} onChange={(e) => setPaiement({ ...paiement, banque: e.target.value.toUpperCase() })} style={{ textTransform: 'uppercase' }} placeholder="ex: BNA, BEA, CPA..." />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <button className="btn btn-primary" disabled={envoi}>
              {envoi ? 'Enregistrement...' : 'Enregistrer'}
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
