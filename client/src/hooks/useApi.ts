'use client';
import {useAuth} from '@clerk/nextjs';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {createApi} from '@/lib/api';
export function useApi(){const {getToken}=useAuth();const [waking,setWaking]=useState(false);const mounted=useRef(true);useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);const onWake=useCallback((value:boolean)=>{if(mounted.current)setWaking(value);},[]);const api=useMemo(()=>createApi(getToken,onWake),[getToken,onWake]);return {api,waking};}
