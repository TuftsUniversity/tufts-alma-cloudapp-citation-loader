import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { MainComponent } from './main/main.component';
import { HelpComponent } from './help/help.component';
import { SettingsComponent } from "./settings/settings.component";
import { LookupToolComponent } from './lookup-tool/lookup-tool.component';

const routes: Routes = [
  { path: '', component: LookupToolComponent },
  { path : 'lookup-tool', component: LookupToolComponent},
  { path: 'main', component: MainComponent },
  { path: "main/settings", component: SettingsComponent},
  { path: 'help', component: HelpComponent}
 
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { useHash: true })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
