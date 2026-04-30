// Auto-generado por PyZero Generator
// Página: Inicio | Slug: /

import React from 'react';
import HeroSection from '../components/sections/HeroSection';
import StatsSection from '../components/sections/StatsSection';
import MenuGridSection from '../components/sections/MenuGridSection';
import TestimonialsSection from '../components/sections/TestimonialsSection';
import ContactSection from '../components/sections/ContactSection';
import { Helmet } from 'react-helmet-async';

export default function InicioPage() {
  return (
    <>
      <Helmet>
        <title>Mi Restaurante</title>
        <meta name="description" content="Bienvenidos" />
      </Helmet>
      <main>
        <HeroSection id="hero-1" props={{"title":"Mi Restaurante","subtitle":"Una experiencia gastronómica única","overlay":0.5,"ctaPrimary":{"label":"Ver Menú","href":"/menu"},"ctaSecondary":{"label":"Reservar Mesa","href":"/reservas"}}} style={{"backgroundColor":"#1C1C1C","textColor":"#fff","backgroundImage":"/assets/scraped_mohsy01o_44f4.webp","backgroundAttachment":"fixed","backgroundSize":"cover","backgroundPosition":"center"}} />
        <StatsSection id="stats-1" props={{"items":[{"value":"15+","label":"Años"},{"value":"2,400+","label":"Clientes"},{"value":"85","label":"Platos"},{"value":"4.9★","label":"Rating"}]}} style={{"backgroundColor":"#f185ff","textColor":"#FFFFFF"}} />
        <MenuGridSection id="menu-1" props={{"title":"Nuestra Carta","subtitle":"Ingredientes frescos, sabores únicos dsa","categories":[{"name":"Entradas"},{"name":"Principales"},{"name":"Postres"}]}} style={{}} />
        <TestimonialsSection id="testimonials-1" props={{"title":"Lo que dicen nuestros clientes","items":[{"name":"María G.","text":"Excelente comida y ambiente.","rating":5},{"name":"Carlos M.","text":"Atención impecable.","rating":5}]}} style={{"backgroundColor":"#f1a2ee","textColor":"#f2ec26","fontSize":"10rem","textAlign":"left"}} />
        <ContactSection id="contact-1" props={{"title":"Contacto","email":"hola@mirestaurante.com","phone":"+54 11 1234-5678","address":"Av. Principal 123"}} style={{}} />
      </main>
    </>
  );
}
