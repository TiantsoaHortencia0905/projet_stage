// src/services/notification.service.ts
import { socketManager } from '../config/socket.manager.ts'; // Importer le manager au lieu de io

interface NotificationPayload {
  id: number;
  type: string;
  titre: string;
  message: string;
  data?: any;
  createdAt: Date;
  lu?: boolean;
}

export class NotificationSocketService {
  /**
   * Émet une notification à un utilisateur spécifique
   * (les identifiants utilisateur sont des UUID ; il n'y a pas de salle « entreprise » dans ce projet)
   */
  static emitToUser(userId: string, notification: NotificationPayload) {
    try {
      socketManager.emitToUser(userId, 'new-notification', notification);
      console.log(`📨 Notification envoyée à l'utilisateur ${userId}`);
    } catch (error) {
      console.error('Erreur émission notification utilisateur:', error);
    }
  }

  /**
   * Crée une notification et l'envoie en temps réel
   */
  static async createAndNotify(
    idEntreprise: number,
    type: string,
    titre: string,
    message: string,
    data?: any,
    targetUserIds?: number[]
  ) {
    // try {
      // 1. Créer la notification en base
    //   const notification = await NotificationController.createAndNotify(
    //     idEntreprise,
    //     type,
    //     titre,
    //     message,
    //     data
    //   );

    //   // 2. Préparer le payload
    //   const notificationPayload: NotificationPayload = {
    //     id: notification.id,
    //     type: notification.type,
    //     titre: notification.titre,
    //     message: notification.message,
    //     data: notification.data,
    //     createdAt: notification.createdAt,
    //     lu: false
    //   };

      // 3. Émettre selon la cible
    //   if (targetUserIds && targetUserIds.length > 0) {
    //     targetUserIds.forEach(userId => {
    //       this.emitToUser(userId, notificationPayload);
    //     });
    //   } else {
    //     this.emitToEntreprise(idEntreprise, notificationPayload);
    //   }

    //   return notification;
    // } catch (error) {
    //   console.error('Erreur création notification:', error);
    //   throw error;
    // }
  }

  /**
   * Marque une notification comme lue
   */
  static async markAsRead(userId: number, notificationId: number) {
    // try {
    //   await NotificationController.markAsRead(userId, notificationId);
      
    //   socketManager.emitToUser(userId, 'notification-read', {
    //     notificationId,
    //     luAt: new Date()
    //   });
      
    //   console.log(`✅ Notification ${notificationId} marquée comme lue pour l'utilisateur ${userId}`);
    // } catch (error) {
    //   console.error('Erreur markAsRead:', error);
    //   throw error;
    // }
  }

  /**
   * Envoie le compteur de notifications non lues
   */
  static async sendUnreadCount(userId: number, idEntreprise: number) {
    // try {
    //   const count = await NotificationController.getUnreadCount(userId, idEntreprise);
    //   socketManager.emitToUser(userId, 'unread-count', { count });
    //   console.log(`📊 Compteur non lues pour user ${userId}: ${count}`);
    //   return count;
    // } catch (error) {
    //   console.error('Erreur sendUnreadCount:', error);
    //   throw error;
    // }
  }
}

// Pour utiliser dans d'autres controllers/services
export const notificationService = NotificationSocketService;