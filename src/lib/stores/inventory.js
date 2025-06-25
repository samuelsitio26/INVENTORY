import { writable } from 'svelte/store';

export const stockStore = writable({
    items: [],
    originalItems: [], // Menyimpan data asli untuk filter
    loading: false
});

export const stockStats = writable({
    totalItems: 0,
    readyItems: 0,
    lowStockItems: 0,
    outOfStockItems: 0
});