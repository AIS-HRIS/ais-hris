'use client';
import {useEffect} from 'react';
export default function InteractionMotion(){
 useEffect(()=>{
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const tap=e=>{if(reduced.matches)return;const button=e.target.closest?.('button');if(!button||button.disabled)return;button.animate([{scale:'1'},{scale:'.95',offset:.3},{scale:'1'}],{duration:340,easing:'cubic-bezier(.2,.8,.2,1)'});};
  document.addEventListener('pointerdown',tap);return()=>document.removeEventListener('pointerdown',tap);
 },[]);return null;
}
