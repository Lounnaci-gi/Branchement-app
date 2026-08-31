import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import client from '../api/client';
import Breadcrumbs from '../components/Breadcrumbs';
import InputDate from '../components/InputDate';
import { imprimerAccuse } from '../utils/impressionAccuse';
import { demanderConfirmation, notifierErreur, notifierSucces } from '../utils/notifications';

const DIAMETRES_STANDARD = ['15mm', '20mm', '25mm', '32mm', '40mm', '50mm', '63mm', '80mm', '100mm', '110mm', '125mm', '150mm', '200mm'];

const VIDE = {
  est_personne_morale: false, raison_sociale: '', nom: '', prenom: '', fils_de: '', ne_le: '', type_piece_identite: '', cin: '', cin_delivre_le: '', cin_delivre_par: '', telephone: '', telephone_secondaire: '', email: '', adresse: '', id_commune_residence: '', id_commune_branchement: '',
  qualite_demandeur: '', id_type: '', nature_travaux: 'Branchement d\'eau potable', type_autre: '', dn_compteur: '', adresse_branchement: '', observations: ''
};

const CHAMPS_TEXTE = new Set([
  'raison_sociale', 'nom', 'prenom', 'fils_de', 'adresse', 'cin_delivre_par',
  'type_autre', 'adresse_branchement', 'observations'
]);
const ORDRE_TYPES_BRANCHEMENT = ['Domestique', 'Administratif', 'Commercial', 'Industriel', 'Chantier', 'Borne d\'incendie', 'Autre'];
const OPTIONS_NATURE_TRAVAUX = [
  'Branchement d\'eau potable',
  'Extension réseau AEP',
  'Rénovation de branchement',
  'Travaux de résiliation',
  'Autres'
];

const TYPES_PAR_NATURE = {
  'Branchement d\'eau potable': ['Domestique', 'Administratif', 'Commercial', 'Industriel', 'Chantier', 'Borne d\'incendie'],
  'Extension réseau AEP': ['Extension de réseau AEP'],
  'Rénovation de branchement': ['Autre'],
  'Travaux de résiliation': ['Autre'],
  'Autres': ['Autre']
};

function normaliserNatureTravaux(valeur) {
  const texte = String(valeur ?? '').trim();
  if (!texte) return '';
  if (texte.startsWith('Autres')) return 'Autres';
  if (texte.startsWith('Branchement d\'eau potable')) return 'Branchement d\'eau potable';
  if (texte.startsWith('Extension réseau AEP')) return 'Extension réseau AEP';
  if (texte.startsWith('Rénovation de branchement')) return 'Rénovation de branchement';
  if (texte.startsWith('Travaux de résiliation')) return 'Travaux de résiliation';
  return texte;
}
const EMAIL_REGEX = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/;

function libelleTypeBranchement(libelle) {
  return {
    Domestique: 'Ménage Individuel',
    Administratif: 'Administration',
    Commercial: 'Commerce',
    'Borne d\'incendie': 'Borne d\'incendie',
    'Extension de réseau AEP': 'Extension de réseau AEP'
  }[libelle] || libelle;
}

function nettoyerSaisie(valeur) {
  return String(valeur ?? '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}

function capitaliserMots(valeur) {
  return String(valeur ?? '').replace(/(^|[\s'-])([\p{L}])/gu, (_, separateur, lettre) => `${separateur}${lettre.toLocaleUpperCase()}`);
}

function emailValide(email) {
  return !email || EMAIL_REGEX.test(String(email).trim());
}

export default function NouvelleDemande() {
  const { id } = useParams();
  const modeEdition = Boolean(id);
  const [form, setForm] = useState(VIDE);
  const [communes, setCommunes] = useState([]);
  const [types, setTypes] = useState([]);
  const [envoi, setEnvoi] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [champRecherche, setChampRecherche] = useState('');
  const [autofillSource, setAutofillSource] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function charger() {
      const [communesResponse, typesResponse] = await Promise.all([
        client.get('/referentiels/communes'),
        client.get('/referentiels/types-branchement')
      ]);
      setCommunes(communesResponse.data);
      setTypes(typesResponse.data);

      if (modeEdition) {
        const response = await client.get(`/demandes/${id}`);
        const demande = response.data.demande;
        const natureTravaux = normaliserNatureTravaux(demande.type_autre || '') || 'Branchement d\'eau potable';
        setForm({
          est_personne_morale: Boolean(demande.est_personne_morale),
          raison_sociale: demande.raison_sociale || '',
          nom: demande.demandeur_nom || '',
          prenom: demande.demandeur_prenom || '',
          fils_de: demande.fils_de || '',
          ne_le: demande.ne_le ? demande.ne_le.slice(0, 10) : '',
          type_piece_identite: demande.type_piece_identite || '',
          cin: demande.cin || '',
          cin_delivre_le: demande.cin_delivre_le ? demande.cin_delivre_le.slice(0, 10) : '',
          cin_delivre_par: demande.cin_delivre_par || '',
          telephone: demande.telephone || '',
          telephone_secondaire: demande.telephone_secondaire || '',
          email: demande.demandeur_email || '',
          adresse: demande.demandeur_adresse || '',
          qualite_demandeur: demande.qualite_demandeur || '',
          id_commune_residence: String(demande.id_commune_residence || ''),
          id_commune_branchement: String(demande.id_commune || ''),
          id_type: String(demande.id_type || ''),
          nature_travaux: natureTravaux,
          type_autre: demande.type_autre || '',
          adresse_branchement: demande.adresse_branchement || '',
          observations: demande.observations || ''
        });
      } else {
        setForm(VIDE);
      }
    }

    charger().catch((err) => notifierErreur(err.response?.data?.erreur || 'Impossible de charger le formulaire.'));
  }, [id, modeEdition]);

  function maj(champ, valeur) {
    const valeurBrute = typeof valeur === 'string' ? nettoyerSaisie(valeur) : valeur;
    const valeurFormatee = CHAMPS_TEXTE.has(champ) ? capitaliserMots(valeurBrute) : valeurBrute;
    setForm((f) => {
      if (champ === 'nature_travaux') {
        const typesAutorises = TYPES_PAR_NATURE[valeurFormatee] || [];
        const idTypeValide = !typesAutorises.length || !f.id_type || types.some((type) => typesAutorises.includes(type.libelle) && String(type.id_type) === String(f.id_type));
        return { ...f, nature_travaux: valeurFormatee, id_type: idTypeValide ? f.id_type : '' };
      }
      return { ...f, [champ]: valeurFormatee };
    });
    if (['nom', 'prenom', 'raison_sociale', 'adresse', 'adresse_branchement'].includes(champ)) {
      setChampRecherche(champ);
      rechercherDemandeurs(valeurFormatee, champ);
    }
  }

  function formaterTelephone(valeur) {
    const chiffres = valeur.replace(/\D/g, '').slice(0, 10);
    return chiffres.replace(/(\d{4})(\d{2})(\d{2})(\d{2}).*/, '$1 $2 $3 $4').trim();
  }

  async function rechercherDemandeurs(valeur, typeRecherche = champRecherche) {
    if (modeEdition || valeur.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    try {
      const { data } = await client.get('/demandes/demandeurs/recherche', {
        params: { q: valeur.trim(), type: typeRecherche }
      });
      if (typeRecherche === 'adresse' || typeRecherche === 'adresse_branchement') {
        const adressesVues = new Set();
        const suggestionsUniques = data.filter((demande) => {
          const adresse = demande[typeRecherche]?.trim().toLowerCase();
          if (!adresse || adressesVues.has(adresse)) return false;
          adressesVues.add(adresse);
          return true;
        });
        setSuggestions(suggestionsUniques);
      } else {
        setSuggestions(data);
      }
    } catch {
      setSuggestions([]);
    }
  }

  function selectionnerDemandeur(suggestion, champ = 'demandeur') {
    if (champ === 'adresse') {
      setForm((f) => ({ ...f, adresse: suggestion.adresse || '' }));
      setSuggestions([]);
      setChampRecherche('');
      return;
    }
    if (champ === 'adresse_branchement') {
      setForm((f) => ({ ...f, adresse_branchement: suggestion.adresse_branchement || '' }));
      setSuggestions([]);
      setChampRecherche('');
      return;
    }

    setForm((f) => ({
      ...f,
      est_personne_morale: Boolean(suggestion.est_personne_morale),
      raison_sociale: suggestion.raison_sociale || '',
      nom: suggestion.nom || '',
      prenom: suggestion.prenom || '',
      fils_de: suggestion.fils_de || '',
      ne_le: suggestion.ne_le ? suggestion.ne_le.slice(0, 10) : '',
      type_piece_identite: suggestion.type_piece_identite || '',
      cin: suggestion.cin || '',
      cin_delivre_le: suggestion.cin_delivre_le ? suggestion.cin_delivre_le.slice(0, 10) : '',
      cin_delivre_par: suggestion.cin_delivre_par || '',
      telephone: suggestion.telephone || '',
      telephone_secondaire: suggestion.telephone_secondaire || '',
      email: suggestion.email || '',
      adresse: suggestion.adresse || '',
      qualite_demandeur: suggestion.qualite_demandeur || '',
      id_commune_residence: String(suggestion.id_commune || '')
    }));
    setAutofillSource(suggestion.numero_demande);
    setSuggestions([]);
    setChampRecherche('');
  }

  async function soumettre(e) {
    e.preventDefault();
    const cinSaisi = String(form.cin ?? '').trim();
    if (!form.est_personne_morale && form.type_piece_identite === 'CIN' && cinSaisi && !/^\d{18}$/.test(cinSaisi)) {
      notifierErreur('Le numéro de CIN doit contenir exactement 18 chiffres.');
      return;
    }

    const emailSaisi = form.email ? String(form.email).trim() : null;
    if (emailSaisi && !emailValide(emailSaisi)) {
      notifierErreur('Veuillez saisir une adresse email valide.');
      return;
    }

    const donneesFormulaire = {
      ...form,
      nom: form.est_personne_morale ? '' : nettoyerSaisie(form.nom ?? ''),
      prenom: form.est_personne_morale ? '' : nettoyerSaisie(form.prenom ?? ''),
      raison_sociale: form.est_personne_morale ? nettoyerSaisie(form.raison_sociale ?? '') : '',
      adresse: nettoyerSaisie(form.adresse ?? ''),
      adresse_branchement: nettoyerSaisie(form.adresse_branchement ?? ''),
      observations: nettoyerSaisie(form.observations ?? ''),
      id_commune_residence: nettoyerSaisie(form.id_commune_residence ?? ''),
      id_commune_branchement: nettoyerSaisie(form.id_commune_branchement ?? '')
    };

    if (!modeEdition && !await demanderConfirmation('Voulez-vous enregistrer cette nouvelle demande ?')) {
      return;
    }

    setEnvoi(true);
    try {
      const natureTravaux = donneesFormulaire.nature_travaux || donneesFormulaire.type_autre || '';
      const typeAutrePayload = natureTravaux === 'Autres' && donneesFormulaire.type_autre && donneesFormulaire.type_autre.trim() !== 'Autres'
        ? `Autres - ${donneesFormulaire.type_autre.trim()}`
        : normaliserNatureTravaux(natureTravaux || donneesFormulaire.type_autre || '');
      const payload = {
        demandeur: {
          est_personne_morale: donneesFormulaire.est_personne_morale,
          qualite_demandeur: donneesFormulaire.qualite_demandeur,
          raison_sociale: donneesFormulaire.raison_sociale,
          nom: donneesFormulaire.nom, prenom: donneesFormulaire.prenom, fils_de: donneesFormulaire.fils_de, ne_le: donneesFormulaire.ne_le,
          type_piece_identite: donneesFormulaire.type_piece_identite, cin: donneesFormulaire.cin,
          cin_delivre_le: donneesFormulaire.cin_delivre_le, cin_delivre_par: donneesFormulaire.cin_delivre_par, telephone: donneesFormulaire.telephone,
          email: emailSaisi, adresse: donneesFormulaire.adresse, id_commune: donneesFormulaire.id_commune_residence,
          telephone_secondaire: donneesFormulaire.telephone_secondaire
        },
        id_type: donneesFormulaire.id_type,
        type_autre: typeAutrePayload,
        adresse_branchement: donneesFormulaire.adresse_branchement,
        id_commune: donneesFormulaire.id_commune_branchement,
        observations: donneesFormulaire.observations
      };
      const { data } = modeEdition
        ? await client.put(`/demandes/${id}`, payload)
        : await client.post('/demandes', payload);

      if (!modeEdition && await demanderConfirmation("Voulez-vous imprimer l'accusé de réception ?")) {
        const typeSelectionne = types.find((type) => String(type.id_type) === String(form.id_type));
        const communeSelectionnee = communes.find((c) => String(c.id_commune) === String(form.id_commune_branchement));
        const communeResidence = communes.find((c) => String(c.id_commune) === String(form.id_commune_residence));
        await imprimerAccuse({
          numero_demande: data.numero_demande,
          date_depot: data.date_depot,
          est_personne_morale: form.est_personne_morale,
          raison_sociale: form.raison_sociale,
          demandeur_nom: form.nom,
          demandeur_prenom: form.prenom,
          demandeur_adresse: form.adresse,
          fils_de: form.fils_de,
          ne_le: form.ne_le,
          type_piece_identite: form.type_piece_identite,
          cin: form.cin,
          cin_delivre_le: form.cin_delivre_le,
          cin_delivre_par: form.cin_delivre_par,
          telephone: form.telephone,
          telephone_secondaire: form.telephone_secondaire,
          qualite_demandeur: form.qualite_demandeur,
          nom_commune_residence: communeResidence?.nom_commune || '',
          adresse_branchement: form.adresse_branchement,
          type_branchement: typeSelectionne?.libelle || '',
          type_autre: form.type_autre,
          nom_commune_branchement: communeSelectionnee?.nom_commune || '',
          nom_agence: communeSelectionnee?.nom_agence || ''
        });
      }
      await notifierSucces(modeEdition ? 'Demande modifiée avec succès.' : 'Demande créée avec succès.');
      navigate(modeEdition ? `/demandes/${id}` : `/demandes/${data.id_demande}`);
    } catch (err) {
      notifierErreur(err.response?.data?.erreur || "Erreur lors de l'enregistrement.");
    } finally {
      setEnvoi(false);
    }
  }

  const typesAffichables = types.filter((type) => !['Extension de réseau AEP', 'Autre'].includes(type.libelle));
  const typesAutorises = (() => {
    const typesNature = TYPES_PAR_NATURE[form.nature_travaux] || null;
    if (!typesNature) return typesAffichables;
    return typesAffichables.filter((type) => typesNature.includes(type.libelle));
  })();
  const typesAutorisesSet = new Set((typesAutorises || []).map((type) => String(type.id_type)));
  const typeSelectionne = types.find((t) => String(t.id_type) === String(form.id_type));
  const communeBranchement = communes.find((c) => String(c.id_commune) === String(form.id_commune_branchement));
  const communeResidence = communes.find((c) => String(c.id_commune) === String(form.id_commune_residence));

  return (
    <div className="page" style={{ maxWidth: 1100 }}>
      <Breadcrumbs
        items={[
          { label: 'Tableau de bord', path: '/', icon: '📊' },
          { label: 'Demandes', path: '/demandes' },
          { label: modeEdition ? 'Modifier la demande' : 'Nouvelle demande' }
        ]}
      />

      <header className="page-header">
        <div>
          <h1>{modeEdition ? 'Modifier la demande' : 'Nouvelle demande'}</h1>
          <p style={{ color: 'var(--color-text-muted)', marginTop: 4 }}>
            {modeEdition ? 'Mise à jour des informations du dossier' : 'Enregistrement d’un nouveau raccordement au réseau AEP'}
          </p>
        </div>
      </header>

      {/* Bannière de confirmation d'auto-remplissage */}
      {autofillSource && (
        <div style={{ background: 'var(--color-success-bg)', border: '1px solid rgba(74, 222, 128, 0.3)', padding: '12px 16px', borderRadius: 10, color: 'var(--color-success)', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>✓</span>
            <span>Données du demandeur préremplies depuis la demande <strong className="mono">{autofillSource}</strong></span>
          </div>
          <button type="button" onClick={() => setAutofillSource(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
      )}

      {/* Grille principale : Formulaire (gauche) + Prévisualisation en direct (droite) */}
      <div className="grille-formulaire">
        
        {/* Formulaire */}
        <form onSubmit={soumettre} className="card" style={{ padding: 28 }}>
          <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>👤</span> Identité du demandeur
          </h3>

          <div className="champ">
            <label htmlFor="type-demandeur">Type de demandeur *</label>
            <select
              id="type-demandeur"
              value={form.est_personne_morale ? 'morale' : 'physique'}
              onChange={(e) => maj('est_personne_morale', e.target.value === 'morale')}
            >
              <option value="physique">Personne physique</option>
              <option value="morale">Personne morale / entreprise</option>
            </select>
          </div>

          <div className="form-grille-2">
            {form.est_personne_morale ? (
              <div className="champ" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="raison-sociale">Raison sociale *</label>
                <div className="demandeur-recherche">
                  <input
                    id="raison-sociale"
                    required
                    value={form.raison_sociale ?? ''}
                    onChange={(e) => maj('raison_sociale', e.target.value)}
                    placeholder="Nom légal de l'entreprise"
                    autoComplete="off"
                  />
                  {champRecherche === 'raison_sociale' && suggestions.length > 0 && (
                    <Suggestions demandes={suggestions} onSelect={selectionnerDemandeur} />
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="champ">
                  <label>Nom *</label>
                  <div className="demandeur-recherche">
                    <input
                      required
                      value={form.nom ?? ''}
                      onChange={(e) => maj('nom', e.target.value)}
                      placeholder="Nom de famille"
                      autoComplete="off"
                    />
                    {champRecherche === 'nom' && suggestions.length > 0 && (
                      <Suggestions demandes={suggestions} onSelect={selectionnerDemandeur} />
                    )}
                  </div>
                </div>
                <div className="champ">
                  <label>Prénom *</label>
                  <div className="demandeur-recherche">
                    <input
                      required
                      value={form.prenom ?? ''}
                      onChange={(e) => maj('prenom', e.target.value)}
                      placeholder="Prénom"
                      autoComplete="off"
                    />
                    {champRecherche === 'prenom' && suggestions.length > 0 && (
                      <Suggestions demandes={suggestions} onSelect={selectionnerDemandeur} />
                    )}
                  </div>
                </div>
                <div className="champ">
                  <label>Fils de</label>
                  <input value={form.fils_de ?? ''} onChange={(e) => maj('fils_de', e.target.value)} placeholder="Prénom du père" />
                </div>
                <div className="champ">
                  <label>Né le</label>
                  <InputDate value={form.ne_le ?? ''} onChange={(val) => maj('ne_le', val)} />
                </div>
                <div className="champ">
                  <label>Type de pièce d’identité</label>
                  <select value={form.type_piece_identite ?? ''} onChange={(e) => maj('type_piece_identite', e.target.value)}>
                    <option value="">Sélectionner...</option>
                    <option value="CIN">CIN (Carte Nationale)</option>
                    <option value="PC">Permis de conduire (PC)</option>
                  </select>
                </div>
                <div className="champ">
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <label>Numéro de pièce</label>
                    {form.type_piece_identite === 'CIN' && (
                      <span style={{ fontSize: 11, color: String(form.cin || '').length === 18 ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                        {String(form.cin || '').length}/18 chiffres
                      </span>
                    )}
                  </div>
                  <input
                    value={form.cin ?? ''}
                    onChange={(e) => maj('cin', e.target.value.replace(/\D/g, '').slice(0, 18))}
                    inputMode="numeric"
                    placeholder="ex: 104239820038472910"
                  />
                </div>
                <div className="champ">
                  <label>Délivré le</label>
                  <InputDate value={form.cin_delivre_le ?? ''} onChange={(val) => maj('cin_delivre_le', val)} />
                </div>
                <div className="champ">
                  <label>Délivré par</label>
                  <input value={form.cin_delivre_par ?? ''} onChange={(e) => maj('cin_delivre_par', e.target.value)} placeholder="ex: Daïra / APC Médéa" />
                </div>
              </>
            )}

            <div className="champ">
              <label htmlFor="qualite-demandeur">Qualité du demandeur *</label>
              <select
                id="qualite-demandeur"
                required
                value={form.qualite_demandeur ?? ''}
                onChange={(e) => maj('qualite_demandeur', e.target.value)}
              >
                <option value="">Sélectionner...</option>
                <option value="PROPRIETAIRE">Propriétaire</option>
                <option value="LOCATAIRE">Locataire</option>
                <option value="MANDATAIRE">Mandataire</option>
              </select>
            </div>

            <div className="champ">
              <label>Téléphone principal</label>
              <input
                value={form.telephone ?? ''}
                onChange={(e) => maj('telephone', formaterTelephone(e.target.value))}
                inputMode="tel"
                placeholder="0552 11 74 33"
              />
            </div>
            <div className="champ">
              <label>Téléphone secondaire</label>
              <input
                value={form.telephone_secondaire ?? ''}
                onChange={(e) => maj('telephone_secondaire', formaterTelephone(e.target.value))}
                inputMode="tel"
                placeholder="0661 22 33 44"
              />
            </div>
            <div className="champ">
              <label>Email</label>
              <input
                type="email"
                value={form.email ?? ''}
                onChange={(e) => maj('email', e.target.value.trimStart())}
                placeholder="client@domaine.dz"
              />
            </div>
          </div>

          <div className="champ">
            <label>Adresse de résidence du demandeur *</label>
            <div className="demandeur-recherche">
              <input
                required
                value={form.adresse ?? ''}
                onChange={(e) => maj('adresse', e.target.value)}
                placeholder="Rue, quartier, n° de porte"
                autoComplete="off"
              />
              {champRecherche === 'adresse' && suggestions.length > 0 && (
                <Suggestions demandes={suggestions} type="adresse" onSelect={(d) => selectionnerDemandeur(d, 'adresse')} />
              )}
            </div>
          </div>

          <div className="champ">
            <label>Commune de résidence *</label>
            <select required value={form.id_commune_residence ?? ''} onChange={(e) => maj('id_commune_residence', e.target.value)}>
              <option value="">Sélectionner la commune...</option>
              {communes.map((c) => (
                <option key={c.id_commune} value={c.id_commune}>{c.nom_commune}</option>
              ))}
            </select>
          </div>

          <h3 style={{ margin: '28px 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>📍</span> Emplacement & Spécifications du branchement
          </h3>

          <div className="form-grille-2">
            <div className="champ">
              <label>Nature des travaux *</label>
              <select required value={form.nature_travaux ?? ''} onChange={(e) => maj('nature_travaux', e.target.value)}>
                <option value="">Sélectionner...</option>
                {OPTIONS_NATURE_TRAVAUX.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
            {form.nature_travaux === 'Branchement d\'eau potable' && (
              <div className="champ" style={{ maxWidth: '100%' }}>
                <label>Type de branchement *</label>
                <select required value={form.id_type ?? ''} onChange={(e) => maj('id_type', e.target.value)} style={{ width: '100%' }}>
                  <option value="">Sélectionner le type...</option>
                  {[...typesAffichables]
                    .sort((a, b) => ORDRE_TYPES_BRANCHEMENT.indexOf(a.libelle) - ORDRE_TYPES_BRANCHEMENT.indexOf(b.libelle))
                    .map((t) => {
                      const estAutorise = typesAutorisesSet.has(String(t.id_type));
                      return (
                        <option key={t.id_type} value={t.id_type} disabled={!estAutorise}>
                          {libelleTypeBranchement(t.libelle)}
                          {!estAutorise && form.nature_travaux ? ' (non compatible)' : ''}
                        </option>
                      );
                    })}
                </select>
              </div>
            )}
            {form.nature_travaux === 'Branchement d\'eau potable' && (
              <div className="champ" style={{ gridColumn: '1 / -1', maxWidth: '50%' }}>
                <label>DN compteur</label>
                <input
                  list="dn-compteur-standard"
                  value={form.dn_compteur ?? ''}
                  onChange={(e) => maj('dn_compteur', e.target.value)}
                  placeholder="ex: 20mm"
                  style={{ width: '100%' }}
                />
                <datalist id="dn-compteur-standard">
                  {DIAMETRES_STANDARD.map((diametre) => (
                    <option key={diametre} value={diametre} />
                  ))}
                </datalist>
              </div>
            )}
            {types.find((t) => String(t.id_type) === String(form.id_type))?.libelle === 'Autre' && (
              <div className="champ" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="type-autre">Préciser le type *</label>
                <input
                  id="type-autre"
                  required
                  value={form.type_autre ?? ''}
                  onChange={(e) => maj('type_autre', e.target.value)}
                  placeholder="Précisez la catégorie exacte"
                />
              </div>
            )}
            {form.nature_travaux === 'Autres' && (
              <div className="champ" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="nature-autre">Préciser la nature des travaux *</label>
                <input
                  id="nature-autre"
                  required
                  value={form.type_autre ?? ''}
                  onChange={(e) => maj('type_autre', e.target.value)}
                  placeholder="Décrivez précisément la nature des travaux"
                />
              </div>
            )}
          </div>

          <div className="champ">
            <label>Adresse exacte du futur branchement *</label>
            <div className="demandeur-recherche">
              <input
                required
                value={form.adresse_branchement ?? ''}
                onChange={(e) => maj('adresse_branchement', e.target.value)}
                placeholder="Lieu exact du raccordement"
                autoComplete="off"
              />
              {champRecherche === 'adresse_branchement' && suggestions.length > 0 && (
                <Suggestions demandes={suggestions} type="adresse_branchement" onSelect={(d) => selectionnerDemandeur(d, 'adresse_branchement')} />
              )}
            </div>
          </div>

          <div className="champ">
            <label>Commune du branchement *</label>
            <select required value={form.id_commune_branchement ?? ''} onChange={(e) => maj('id_commune_branchement', e.target.value)}>
              <option value="">Sélectionner la commune de raccordement...</option>
              {communes.map((c) => (
                <option key={c.id_commune} value={c.id_commune}>{c.nom_commune}</option>
              ))}
            </select>
          </div>

          <div className="champ">
            <label>Observations & Notes complémentaires</label>
            <textarea rows={3} value={form.observations ?? ''} onChange={(e) => maj('observations', e.target.value)} placeholder="Contraintes terrain, repère particulier..." />
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <button type="submit" className="btn btn-primary" disabled={envoi}>
              <span>💾</span>
              <span>{envoi ? 'Enregistrement...' : modeEdition ? 'Enregistrer les modifications' : 'Déposer la demande'}</span>
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>Annuler</button>
          </div>
        </form>

        {/* Volet de prévisualisation latérale en temps réel */}
        <div style={{ position: 'sticky', top: 20 }}>
          <div className="card" style={{ padding: 22, border: '1px dashed var(--color-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-primary)' }}>
                Aperçu du dossier en direct
              </span>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>ADE Suivi AEP</span>
            </div>

            <div style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>
                {form.est_personne_morale
                  ? (form.raison_sociale || 'Raison sociale non saisie')
                  : ([form.nom, form.prenom].filter(Boolean).join(' ') || 'Nom & Prénom')}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                {form.qualite_demandeur || 'Qualité non spécifiée'} · {form.telephone || 'Sans téléphone'}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12.5 }}>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: 11 }}>Pièce d’identité</span>
                <strong>{form.type_piece_identite || 'Pièce'} : {form.cin || '—'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: 11 }}>Résidence</span>
                <span>{form.adresse || '—'} {communeResidence ? `(${communeResidence.nom_commune})` : ''}</span>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: 11 }}>Type de branchement</span>
                <strong style={{ color: 'var(--color-primary)' }}>{typeSelectionne?.libelle || 'Non sélectionné'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: 11 }}>Lieu de raccordement</span>
                <span>{form.adresse_branchement || '—'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: 11 }}>Agence responsable</span>
                <span style={{ fontWeight: 600 }}>{communeBranchement?.nom_agence || 'Sélectionner une commune'}</span>
              </div>
            </div>

            <div style={{ marginTop: 18, paddingTop: 12, borderTop: '1px solid var(--color-border)', fontSize: 11.5, color: 'var(--color-text-muted)' }}>
              🖨 Après soumission, vous pourrez choisir d'imprimer l'accusé de réception et le formulaire A4.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function Suggestions({ demandes, type = 'demandeur', onSelect }) {
  const rechercheAdresse = type === 'adresse' || type === 'adresse_branchement';
  return (
    <div className="demandeur-suggestions">
      <div className="demandeur-suggestions-titre">
        {rechercheAdresse ? 'Adresses déjà enregistrées' : 'Demandes antérieures correspondantes'}
      </div>
      {demandes.map((demande) => (
        <button type="button" className="demandeur-suggestion" key={demande.id_demande} onClick={() => onSelect(demande)}>
          {rechercheAdresse ? (
            <strong>{demande[type] || 'Adresse non renseignée'}</strong>
          ) : (
            <>
              <span>
                <strong>{demande.est_personne_morale ? demande.raison_sociale : `${demande.nom} ${demande.prenom}`}</strong>
                <small>{demande.telephone} · {demande.nom_commune}</small>
              </span>
              <span className="demandeur-suggestion-demande">
                {demande.numero_demande}<small>{demande.statut_libelle}</small>
              </span>
            </>
          )}
        </button>
      ))}
    </div>
  );
}
