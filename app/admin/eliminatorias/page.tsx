import { redirect } from 'next/navigation';

// Esta página gestionaba las eliminatorias con el sistema viejo
// (matches/predictions con equipos fijos editados a mano). Ahora esas
// rondas se gestionan con el cuadro dinámico. Se mantiene el archivo por
// si hace falta consultar el código antiguo, pero ya no es accesible.
export default function AdminEliminatoriasPage() {
  redirect('/admin/cuadro');
}
