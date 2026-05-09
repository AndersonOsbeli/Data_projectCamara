import { Routes } from '@angular/router';
import { Dashboard } from './pages/dashboard/dashboard';
import { Cameras } from './pages/cameras/cameras';
import { Demographics } from './pages/demographics/demographics';
import { Reports } from './pages/reports/reports';
import { Settings } from './pages/settings/settings';
import { Login } from './pages/login/login';
import { authGuard } from './services/auth.guard';

export const routes: Routes = [
  { path: 'login', component: Login },
  { path: 'dashboard', component: Dashboard, canActivate: [authGuard] },
  { path: 'cameras', component: Cameras, canActivate: [authGuard] },
  { path: 'demographics', component: Demographics, canActivate: [authGuard] },
  { path: 'reports', component: Reports, canActivate: [authGuard] },
  { path: 'settings', component: Settings, canActivate: [authGuard] },
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' }
];
