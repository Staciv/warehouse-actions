import { isFirebaseMode } from '../../constants/app';
import { FirebaseRepository } from '../firebase/firebaseRepository';
import { isFirebaseConfigured } from '../firebase/client';
import { MockRepository } from '../mock/mockRepository';
import type { Repository } from './types';

let repository: Repository | null = null;

export const getRepository = (): Repository => {
  if (repository) return repository;

  if (isFirebaseMode) {
    if (!isFirebaseConfigured) {
      throw new Error('VITE_DATA_MODE=firebase, ale Firebase env nie jest skonfigurowany. Sprawdź .env');
    }
    repository = new FirebaseRepository();
    return repository;
  }

  repository = new MockRepository();
  return repository;
};
