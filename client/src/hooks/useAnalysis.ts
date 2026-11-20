'use client';
import {useEffect,useState,useCallback} from 'react';
import type {Analysis} from '@/lib/types';
import {useApi} from './useApi';
export function useAnalysis(id:string){
 const {api,waking}=useApi();const [analysis,setAnalysis]=useState<Analysis|null>(null);const [error,setError]=useState('');const [version,setVersion]=useState(0);
 const retry=useCallback(()=>{setError('');setVersion(v=>v+1);},[]);
 useEffect(()=>{
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;
  setAnalysis(null);
  async function poll(){try{const result=await api.get(id,controller.signal);if(controller.signal.aborted)return;setAnalysis(result);setError('');if(['pending','processing'].includes(result.status))timer=setTimeout(poll,2000);}catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Could not load this analysis.');}}
  void poll();return()=>{controller.abort();clearTimeout(timer);};
 },[api,id,version]);
 return {analysis,error,waking,retry};
}
