import mongoose, { Document, Schema } from 'mongoose';

export interface IPax extends Document {
  name: string;
  cpf: string;
  phoneNumber: string;
  email?: string; // Campo opcional para email
  sent: boolean;
  unavailable: boolean; // 🎯 Marca PAX como indisponível (vai para fim da fila)
  sequenceId: number; // 🎯 Controla ordem da fila
  createdAt: Date;
  updatedAt: Date;
}

const PaxSchema = new Schema<IPax>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    cpf: {
      type: String,
      required: true,
      trim: true,
      unique: true, // CPF único
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true, // Normalizar email
    },
    sent: {
      type: Boolean,
      required: true,
      default: false, // Por padrão, não foi enviado
    },
    unavailable: {
      type: Boolean,
      required: true,
      default: false, // 🎯 Por padrão, está disponível
    },
    sequenceId: {
      type: Number,
      required: true,
      unique: true, // Sequence único para controlar ordem
    },
  },
  {
    timestamps: true,
    collection: 'pax',
  },
);

// Indexes para performance
PaxSchema.index({ cpf: 1 }, { unique: true });
PaxSchema.index({ sequenceId: 1 }, { unique: true }); // 🎯 Index principal para fila
PaxSchema.index({ sent: 1, sequenceId: 1 }); // Composite index para busca na fila
PaxSchema.index({ unavailable: 1, sequenceId: 1 }); // 🎯 Index para unavailable
PaxSchema.index({ phoneNumber: 1 }); // Para verificar quem já recebeu QR Code

export const Pax = mongoose.model<IPax>('Pax', PaxSchema);
