'use client';
import {createContext,useContext} from 'react';
export const AttendanceIdentity=createContext(null);
export const useAttendanceIdentity=()=>useContext(AttendanceIdentity);
