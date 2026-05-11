import { create } from 'zustand';

export type ServiceType = 'pickle' | 'picknow';

const SERVICE_TOKEN_KEYS: Record<ServiceType, string> = {
  pickle: 'pickleToken',
  picknow: 'picknowToken',
};

export const getServiceToken = (service: ServiceType): string | null =>
  localStorage.getItem(SERVICE_TOKEN_KEYS[service]);

export const setServiceToken = (service: ServiceType, token: string): void =>
  localStorage.setItem(SERVICE_TOKEN_KEYS[service], token);

export const clearServiceToken = (service: ServiceType): void =>
  localStorage.removeItem(SERVICE_TOKEN_KEYS[service]);

interface ServiceState {
  selectedService: ServiceType | null;
  setSelectedService: (service: ServiceType) => void;
  clearSelectedService: () => void;
}

export const useServiceStore = create<ServiceState>((set) => ({
  selectedService: (localStorage.getItem('selectedService') as ServiceType) || null,
  setSelectedService: (service) => {
    localStorage.setItem('selectedService', service);
    set({ selectedService: service });
  },
  clearSelectedService: () => {
    localStorage.removeItem('selectedService');
    set({ selectedService: null });
  },
}));
