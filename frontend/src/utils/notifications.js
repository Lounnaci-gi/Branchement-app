import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

function getSwalThemeOptions() {
  const isDark = document.documentElement.dataset.theme === 'dark';
  return {
    background: isDark ? '#111D2A' : '#FFFFFF',
    color: isDark ? '#F1F5F9' : '#1E384D',
    confirmButtonColor: isDark ? '#0284C7' : '#2599FB',
    cancelButtonColor: isDark ? '#334155' : '#94A3B8'
  };
}

export function notifierSucces(message) {
  return Swal.fire({
    icon: 'success',
    title: 'Succès',
    text: message,
    confirmButtonText: 'OK',
    ...getSwalThemeOptions()
  });
}

export function notifierErreur(message) {
  return Swal.fire({
    icon: 'error',
    title: 'Erreur',
    text: message,
    confirmButtonText: 'OK',
    ...getSwalThemeOptions()
  });
}

export async function demanderConfirmation(message) {
  const resultat = await Swal.fire({
    icon: 'question',
    title: 'Confirmation',
    text: message,
    showCancelButton: true,
    confirmButtonText: 'Oui',
    cancelButtonText: 'Non',
    ...getSwalThemeOptions()
  });
  return resultat.isConfirmed;
}
