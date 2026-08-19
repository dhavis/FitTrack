import { LengthUnit, WeightUnit } from '../types/db';

const KG_PER_LB = 0.45359237;
const CM_PER_IN = 2.54;

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}

export function cmToIn(cm: number): number {
  return cm / CM_PER_IN;
}

export function inToCm(inches: number): number {
  return inches * CM_PER_IN;
}

export function displayWeight(kg: number, unit: WeightUnit): number {
  return unit === 'kg' ? kg : kgToLb(kg);
}

export function toStorageWeightKg(value: number, unit: WeightUnit): number {
  return unit === 'kg' ? value : lbToKg(value);
}

export function displayLength(cm: number, unit: LengthUnit): number {
  return unit === 'cm' ? cm : cmToIn(cm);
}

export function toStorageLengthCm(value: number, unit: LengthUnit): number {
  return unit === 'cm' ? value : inToCm(value);
}

export function formatWeight(kg: number, unit: WeightUnit, fractionDigits = 1): string {
  return `${displayWeight(kg, unit).toFixed(fractionDigits)} ${unit}`;
}
