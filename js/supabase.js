const SUPABASE_URL = 'https://fdbzmikfaesemjldarrg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkYnptaWtmYWVzZW1qbGRhcnJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MzM5MzYsImV4cCI6MjA4NzAwOTkzNn0.WRi1niW3M9mZqtfoe9qVQgtu7CsUAh6Ns01LJ9R7eHY';

window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const db = {
    async find(table, where = {}) {
        let query = window.supabase.from(table).select('*');
        Object.keys(where).forEach(key => {
            query = query.eq(key, where[key]);
        });
        const { data, error } = await query;
        return { data, error };
    },
    
    async findOne(table, where = {}) {
        let query = window.supabase.from(table).select('*').maybeSingle();
        Object.keys(where).forEach(key => {
            query = query.eq(key, where[key]);
        });
        const { data, error } = await query;
        return { data, error };
    },

    async insert(table, data) {
        const { data: result, error } = await window.supabase
            .from(table)
            .insert([data])
            .select();
        return { data: result?.[0], error };
    },

    async update(table, data, where) {
        let query = window.supabase.from(table).update(data);
        Object.keys(where).forEach(key => {
            query = query.eq(key, where[key]);
        });
        const { data: result, error } = await query.select();
        return { data: result?.[0], error };
    }
};