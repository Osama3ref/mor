import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where, orderBy, limit, addDoc, runTransaction, getDocs } from 'firebase/firestore';
window.FB = { initializeApp, getAuth, signInAnonymously, onAuthStateChanged, getFirestore, doc, setDoc, getDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where, orderBy, limit, addDoc, runTransaction, getDocs };
