import { formaterDesignationAvecType } from '../../utils/devisAffichage';
import { normaliserTypeLigne } from '../../utils/devisLigneTypes';
import {
  formaterMontant,
  libelleArticleSansCategorie,
  montantEnLettres,
  nomAbonne
} from '../../utils/devisDocumentFormat';
import { formaterNumeroSection, MODE_NUMEROTATION_DEFAUT } from '../../utils/devisNumerotation';
import './DocumentDevis.css';

function formaterDate(valeur) {
  const date = new Date(valeur);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('fr-FR');
}

function dateValidite(valeur) {
  const date = new Date(valeur);
  if (Number.isNaN(date.getTime())) return '—';
  date.setMonth(date.getMonth() + 1);
  return date.toLocaleDateString('fr-FR');
}

function CoordonneesAde() {
  return (
    <address className="devis-coords-ade">
      <strong>E.P. Algérienne des eaux</strong>
      <span>Ministère des ressources en eau</span>
      <span>Unité de Médéa — Agence Berrouaghia</span>
      <span>Zone d’Alger</span>
    </address>
  );
}

function BlocClient({ demande, titre = 'Client' }) {
  return (
    <section className="devis-bloc-client">
      <span className="devis-bloc-client-titre">{titre}</span>
      <strong>{nomAbonne(demande)}</strong>
      <span>{demande.adresse_branchement || '—'}</span>
      <span>{demande.nom_commune || 'Commune non renseignée'}</span>
      <span>Tél. {demande.telephone || demande.telephone_secondaire || 'Non renseigné'}</span>
    </section>
  );
}

function TableauArticles({
  aDesArticles,
  categoriesTriees,
  articlesParCategorie,
  devis,
  modeNumerotationSections = MODE_NUMEROTATION_DEFAUT,
  numerote = false,
  detailedTva = false,
  chantier = false
}) {
  let indexLigne = 0;
  const tvaVisible = detailedTva || chantier;
  const nombreColonnes = 5 + Number(numerote) + Number(tvaVisible) + Number(detailedTva);
  return (
    <div className="devis-table-wrap">
    <table className={`devis-articles-table ${detailedTva ? 'devis-articles-table--tva' : ''} ${chantier ? 'devis-articles-table--chantier' : ''}`}>
      <thead>
        <tr>
          {numerote ? <th className="col-num">N°</th> : null}
          <th className="col-desig">Désignation</th>
          <th className="col-qte">Qté</th>
          <th className="col-unite">Unité</th>
          <th className="col-pu">Prix unitaire HT</th>
          {tvaVisible ? <th className="col-tva">{chantier ? 'TVA' : '% TVA'}</th> : null}
          {detailedTva ? <th className="col-tva-total">Total TVA</th> : null}
          <th className="col-total">{detailedTva ? 'Total TTC' : chantier ? 'Total HT' : 'Montant HT'}</th>
        </tr>
      </thead>
      <tbody>
        {aDesArticles ? (
          categoriesTriees.flatMap((categorie, categorieIndex) => {
            const articles = articlesParCategorie.get(categorie) || [];
            const totalCategorie = articles.reduce(
              (total, article) => total + Number(article.montantLigne ?? (Number(article.quantite || 0) * Number(article.prix || 0))),
              0
            );
            return [
              <tr key={`categorie-${categorie}`} className={chantier ? 'devis-categorie-row' : undefined}>
                {chantier ? (
                  <>
                    <td className="col-num devis-categorie-numero">
                      {formaterNumeroSection(categorieIndex, modeNumerotationSections)}.
                    </td>
                    <td className="col-desig"><strong>{categorie}</strong></td>
                    <td colSpan={nombreColonnes - 4} />
                    <td colSpan={2} className="devis-categorie-sous-total">
                      <span>Sous-total</span>
                      <strong>{formaterMontant(totalCategorie)}</strong>
                    </td>
                  </>
                ) : (
                  <td colSpan={nombreColonnes} className="devis-categorie-header">
                    <strong>{formaterNumeroSection(categorieIndex, modeNumerotationSections)}- {categorie}</strong>
                  </td>
                )}
              </tr>,
              ...articles.map((art, artIndex) => {
                indexLigne += 1;
                const codeType = normaliserTypeLigne(art.type || art.type_ligne, art.choixPrix || art.choix_prix, art.modePrix || art.mode_prix, art);
                const numeroCategorie = chantier
                  ? formaterNumeroSection(categorieIndex, modeNumerotationSections)
                  : String(categorieIndex + 1);
                const numero = `${numeroCategorie}.${artIndex + 1}`;
                const quantite = Number(art.quantite || 0);
                const prix = Number(art.prix || 0);
                const montantHt = Number(art.montantLigne ?? (quantite * prix));
                const tauxTva = Number(art.tauxTva ?? art.taux_tva ?? 0);
                const montantTva = montantHt * tauxTva / 100;
                return (
                  <tr key={art.id_ligne || art.code || indexLigne}>
                    {numerote ? <td className="col-num">{numero}</td> : null}
                    <td className="col-desig">
                      <strong>{formaterDesignationAvecType(codeType, libelleArticleSansCategorie(art.libelle))}</strong>
                      {art.code ? <small className="devis-article-meta">{art.code}</small> : null}
                      {(art.matiere || art.couleur) ? <small className="devis-article-meta">{[art.matiere, art.couleur].filter(Boolean).join(' · ')}</small> : null}
                    </td>
                    <td className="col-qte">{art.quantite}</td>
                    <td className="col-unite">{art.unite || 'U'}</td>
                    <td className="col-pu">{formaterMontant(art.prix)}</td>
                    {tvaVisible ? <td className="col-tva">{tauxTva} %</td> : null}
                    {detailedTva ? <td className="col-tva-total">{formaterMontant(montantTva)}</td> : null}
                    <td className="col-total">{detailedTva ? formaterMontant(montantHt + montantTva) : formaterMontant(montantHt)}</td>
                  </tr>
                );
              })
            ];
          })
        ) : (
          <tr>
            {numerote ? <td className="col-num">1</td> : null}
            <td className="col-desig">Prestations et fournitures relatives aux travaux</td>
            <td className="col-qte">1</td>
            <td className="col-unite">U</td>
            <td className="col-pu">{formaterMontant(devis.montant)}</td>
            {tvaVisible ? <td className="col-tva">0 %</td> : null}
            {detailedTva ? <td className="col-tva-total">{formaterMontant(0)}</td> : null}
            <td className="col-total">{formaterMontant(devis.montant)}</td>
          </tr>
        )}
      </tbody>
    </table>
    </div>
  );
}

function Totaux({ totalHtArticles, totalTvaArticles, devis, libelleTtc = 'Total TTC' }) {
  return (
    <section className="devis-totaux">
      <div><span>Total HT</span><strong>{formaterMontant(totalHtArticles)} DA</strong></div>
      {totalTvaArticles > 0 ? (
        <div><span>TVA</span><strong>{formaterMontant(totalTvaArticles)} DA</strong></div>
      ) : (
        <div><span>TVA</span><strong>Selon catégorie</strong></div>
      )}
      <div className="devis-total-ttc"><span>{libelleTtc}</span><strong>{formaterMontant(devis.montant)} DA</strong></div>
      <p className="devis-montant-en-lettres">
        <span>Montant total en lettres</span>
        <strong>{montantEnLettres(devis.montant)}</strong>
      </p>
    </section>
  );
}

function Vague({ classe, forme = 'bande' }) {
  const chemin = forme === 'coupe'
    ? 'M0 72 C 220 8, 520 96, 1200 22 L 1200 72 Z'
    : 'M0,0 H1200 V28 C980,72 780,8 600,36 C380,72 180,8 0,40 Z';
  return (
    <svg className={classe} viewBox="0 0 1200 72" preserveAspectRatio="none" aria-hidden="true">
      <path d={chemin} />
    </svg>
  );
}

export default function DocumentDevis({
  modele,
  logoDevis,
  demande,
  devis,
  nature,
  aDesArticles,
  categoriesTriees,
  articlesParCategorie,
  totalHtArticles,
  totalTvaArticles,
  modeNumerotationSections = MODE_NUMEROTATION_DEFAUT
}) {
  const dateEmission = formaterDate(devis.date_emission);
  const validite = dateValidite(devis.date_emission);
  const tableProps = { aDesArticles, categoriesTriees, articlesParCategorie, devis, modeNumerotationSections };

  if (modele === 'moderne') {
    return (
      <article className="devis-document devis-modele-moderne">
        <div className="devis-moderne-page">
          <h1 className="devis-mega-titre">Devis</h1>
          <div className="devis-moderne-meta">
            <BlocClient demande={demande} titre="Pour" />
            <div className="devis-moderne-dates">
              <p><b>Date :</b> {dateEmission}</p>
              <p><b>N° :</b> {devis.numero_devis}</p>
              <p><b>Validité :</b> 1 mois ({validite})</p>
              <p><b>Objet :</b> {nature}</p>
            </div>
          </div>
          <TableauArticles {...tableProps} />
          <Totaux totalHtArticles={totalHtArticles} totalTvaArticles={totalTvaArticles} devis={devis} libelleTtc="Total" />
        </div>
        <footer className="devis-pied-agence">
          <div>
            <strong>Algérienne des eaux</strong>
            <CoordonneesAde />
          </div>
          <p>Merci pour votre confiance.</p>
        </footer>
      </article>
    );
  }

  if (modele === 'compact') {
    return (
      <article className="devis-document devis-modele-compact">
        <header className="devis-epure-entete">
          <h1>Devis n° {devis.numero_devis}</h1>
          <div className="devis-logo-rond">
            <img className="devis-logo" src={logoDevis} alt="Logo ADE" />
          </div>
        </header>
        <CoordonneesAde />
        <div className="devis-epure-colonnes">
          <dl className="devis-fiche-meta">
            <div><dt>Date du devis</dt><dd>{dateEmission}</dd></div>
            <div><dt>Référence</dt><dd>{devis.numero_devis}</dd></div>
            <div><dt>Date de validité</dt><dd>{validite}</dd></div>
            <div><dt>Objet</dt><dd>{nature}</dd></div>
          </dl>
          <BlocClient demande={demande} titre="Destinataire" />
        </div>
        <TableauArticles {...tableProps} />
        <Totaux totalHtArticles={totalHtArticles} totalTvaArticles={totalTvaArticles} devis={devis} />
        <footer className="devis-pied-trois">
          <div><span>Siège</span><CoordonneesAde /></div>
          <div><span>Validité</span><p>Offre valable jusqu’au {validite}</p></div>
          <div><span>Visa agence</span><p>Le chef d’agence commerciale</p></div>
        </footer>
        <div className="devis-barre-bas" />
      </article>
    );
  }

  if (modele === 'institutionnel') {
    return (
      <article className="devis-document devis-modele-institutionnel">
        <header className="devis-marine-entete">
          <Vague classe="devis-vague devis-vague--haut" forme="coupe" />
          <h1>Devis N° {devis.numero_devis}</h1>
        </header>
        <div className="devis-marine-corps">
          <div className="devis-marine-meta">
            <ul>
              <li><b>Date du devis :</b> {dateEmission}</li>
              <li><b>Date de validité :</b> {validite}</li>
              <li><b>Émis par :</b> Agence Berrouaghia</li>
              <li><b>Objet :</b> {nature}</li>
            </ul>
            <BlocClient demande={demande} titre="Destinataire" />
          </div>
          <TableauArticles {...tableProps} />
          <div className="devis-bas-page">
            <Totaux totalHtArticles={totalHtArticles} totalTvaArticles={totalTvaArticles} devis={devis} />
          </div>
        </div>
        <footer className="devis-marine-pied">
          <div>
            <span>Informations</span>
            <CoordonneesAde />
          </div>
          <strong>Merci beaucoup !</strong>
        </footer>
      </article>
    );
  }

  if ([
    'prestige', 'rubis', 'graphite', 'lagon', 'sienne', 'azur',
    'corporate', 'professionnel', 'chantier', 'navy-corner', 'cyan-groupe', 'atelier', 'quantitatif', 'structure',
    'orange', 'minimal-turquoise', 'ecobat', 'avenant'
  ].includes(modele)) {
    const chantier = modele === 'chantier';
    const numerote = chantier || ['rubis', 'graphite', 'atelier', 'quantitatif', 'structure'].includes(modele);
    const detailedTva = modele === 'orange';
    return (
      <article className={`devis-document devis-modele-theme devis-modele-${modele}`}>
        <header className={`devis-theme-entete devis-theme-entete--${modele}`}>
          <img className="devis-logo" src={logoDevis} alt="Logo ADE" />
          <div className="devis-theme-emetteur"><CoordonneesAde /></div>
          <div className="devis-theme-reference">
            <span>{modele === 'avenant' ? 'Avenant au devis' : 'Devis de branchement'}</span>
            <h1>N° {devis.numero_devis}</h1>
            <p>Émis le {dateEmission}</p>
            <p>Valable jusqu’au {validite}</p>
          </div>
        </header>
        <div className="devis-theme-corps">
          <div className={`devis-theme-infos ${chantier ? 'devis-chantier-infos' : ''}`}>
            <BlocClient demande={demande} titre="Destinataire" />
            {!chantier ? (
              <section className="devis-theme-objet">
                <span>Objet du devis</span>
                <strong>{nature}</strong>
              </section>
            ) : null}
          </div>
          {chantier ? (
            <h2 className="devis-chantier-objet">{nature}</h2>
          ) : null}
          <TableauArticles {...tableProps} numerote={numerote} detailedTva={detailedTva} chantier={chantier} />
          <div className="devis-theme-totaux">
            <Totaux totalHtArticles={totalHtArticles} totalTvaArticles={totalTvaArticles} devis={devis} />
          </div>
          <footer className="devis-theme-pied">
            <section>
              <strong>Conditions</strong>
              <span>Offre valable jusqu’au {validite}.</span>
              <span>{chantier ? 'Les dates d’exécution sont à convenir avec l’agence.' : 'Le devis est soumis à validation de l’agence.'}</span>
            </section>
            {modele === 'chantier' ? (
              <section className="devis-chantier-accord">
                <strong>Bon pour accord</strong>
                <span>Date, signature et mention « Bon pour accord ».</span>
              </section>
            ) : null}
          </footer>
        </div>
      </article>
    );
  }

  return (
    <article className="devis-document devis-modele-classique">
      <Vague classe="devis-vague devis-vague--haut" />
      <div className="devis-classique-corps">
        <header className="devis-classique-entete">
          <img className="devis-logo" src={logoDevis} alt="Logo ADE" />
          <div className="devis-classique-titre">
            <h1>Devis N° {devis.numero_devis}</h1>
            <p>Berrouaghia, le {dateEmission}</p>
          </div>
        </header>
        <div className="devis-classique-intro">
          <CoordonneesAde />
          <BlocClient demande={demande} titre="Client" />
        </div>
        <p className="devis-objet"><b>Objet :</b> {nature}</p>
        <TableauArticles {...tableProps} />
        <div className="devis-bas-page">
          <section className="devis-cadre-client devis-conditions">
            <b>Modalités et conditions</b>
            <p>Le présent devis est valable jusqu’au {validite}.</p>
          </section>
          <Totaux totalHtArticles={totalHtArticles} totalTvaArticles={totalTvaArticles} devis={devis} />
        </div>
        <div className="devis-classique-visa">
          <p>Offre valable jusqu’au {validite}</p>
          <div className="devis-cadre-client devis-signature-cadre">
            <span>Signature</span>
            <strong>Le chef d’agence commerciale</strong>
          </div>
        </div>
        <p className="devis-mentions">Algérienne des eaux — Unité de Médéa — Agence Berrouaghia</p>
      </div>
      <Vague classe="devis-vague devis-vague--bas" />
    </article>
  );
}
