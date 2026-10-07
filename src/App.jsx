import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import Header from './navigation';
import { Footer } from './components';
import PageTransition from './PageTransition';
import HomePage from './pages/HomePage';
import { InventoryPage, VehicleDetailsPage } from './inventory';

const ReviewsPage = lazy(() => import('./pages/ReviewsPage'));
const info = name => lazy(() => import('./pages/InfoPages').then(module => ({ default: module[name] })));
const AboutPage = info('AboutPage'), ServicesPage = info('ServicesPage'), ServicePage = info('ServicePage'), NotFoundPage = info('NotFoundPage');

export default function App() {
  return <><Header/><PageTransition>{location => <><main id="main-content" tabIndex={-1}><div className="route-content" key={location.pathname}><Suspense fallback={<div className="route-loading" role="status"><span className="loading-ring"/>Preparing your next chapter…</div>}>
    <Routes location={location}>
      <Route path="/" element={<HomePage/>}/>
      <Route path="/index.html" element={<HomePage/>}/>
      <Route path="/all-vehicles.html" element={<InventoryPage/>}/>
      <Route path="/car-details.html" element={<VehicleDetailsPage/>}/>
      <Route path="/services.html" element={<ServicesPage/>}/>
      <Route path="/aboutus.html" element={<AboutPage/>}/>
      <Route path="/reviews.html" element={<ReviewsPage/>}/>
      <Route path="/sell-your-vehicle-sri-lanka.html" element={<ServicePage kind="sell"/>}/>
      <Route path="/vehicle-sourcing-sri-lanka.html" element={<ServicePage kind="sourcing"/>}/>
      <Route path="/vehicle-information-support.html" element={<ServicePage kind="support"/>}/>
      <Route path="*" element={<NotFoundPage/>}/>
    </Routes>
  </Suspense></div></main><Footer/></>}</PageTransition></>;
}
