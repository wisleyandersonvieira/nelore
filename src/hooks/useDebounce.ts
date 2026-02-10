import { useState, useEffect } from 'react';

/**
 * Hook para atrasar a atualização de um valor até que pare de mudar
 * @param value - O valor a ser debounced
 * @param delay - Delay em milissegundos (padrão: 300ms)
 * @returns O valor debounced
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
