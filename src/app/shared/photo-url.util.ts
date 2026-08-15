import { environment } from '../../environments/environment';

export function photoUrl(photo?: string | null): string {
  if (!photo) return '';
  if (photo.startsWith('http') || photo.startsWith('data:')) return photo;
  return `${environment.fileBaseUrl}${photo}`;
}
