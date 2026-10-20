import { type Request, type Response } from 'express';
import prisma from "../../config/prisma.config.ts";
import { type RequestResponse } from '../../model/index.ts';


export default class AlertsController {
  
  async findAll(req: Request, res: Response): Promise<Response> {
    try {
      const idUtilisateur = req.currentUser!.userId; // garanti par authMiddleware
      if (!idUtilisateur) {
        return res
          .status(401)
          .json({ success: false, message: 'Utilisateur non authentifié' });
      }

      const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
      const limit = Math.min(
        100,
        Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20),
      );
      const skip = (page - 1) * limit;

      const where: any = { deploiement: { projet: { idUtilisateur } } };
      if (req.query.idDeploiement)
        where.idDeploiement = String(req.query.idDeploiement);
      if (req.query.prioriteAlerte)
        where.prioriteAlerte = String(req.query.prioriteAlerte);
      if (req.query.validationAlerte !== undefined)
        where.validationAlerte = String(req.query.validationAlerte) === 'true';
      if (req.query.alerteResolu !== undefined)
        where.alerteResolu = String(req.query.alerteResolu) === 'true';

      const [items, total] = await Promise.all([
        prisma.alerte.findMany({
          where,
          skip,
          take: limit,
          orderBy: { dateAlerte: 'desc' },
          // Nom de l'application concernée, pour l'afficher sans requête supplémentaire
          include: { deploiement: { select: { idDeploiement: true, projet: { select: { idProjet: true, nomProjet: true } } } } },
        }),
        prisma.alerte.count({ where }),
      ]);

      const body: RequestResponse<{
        items: typeof items;
        total: number;
        page: number;
        limit: number;
      }> = {
        success: true,
        data: { items, total, page, limit },
      };
      return res.status(200).json(body);
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des alertes',
      });
    }
  }

  async findOne(req: Request, res: Response): Promise<Response> {
    try {
      const idUtilisateur = req.currentUser!.userId; // garanti par authMiddleware
      const { idAlerte } = req.params;

      const alerte = await prisma.alerte.findFirst({
        where: {
          idAlerte: idAlerte!,
          deploiement: { projet: { idUtilisateur } },
        },
        include: { deploiement: true },
      });

      if (!alerte) {
        return res
          .status(404)
          .json({ success: false, message: 'Alerte introuvable' });
      }

      const body: RequestResponse<typeof alerte> = {
        success: true,
        data: alerte,
      };
      return res.status(200).json(body);
    } catch (error) {
      return res
        .status(500)
        .json({ success: false, message: 'Erreur interne du serveur' });
    }
  }

  
  async create(req: Request, res: Response): Promise<Response> {
    try {
      const idUtilisateur = req.currentUser!.userId; // garanti par authMiddleware
      const {
        titreAlerte,
        prioriteAlerte,
        idDeploiement,
        validationAlerte,
        alerteResolu,
      } = req.body ?? {};

      if (!titreAlerte || !prioriteAlerte || !idDeploiement) {
        return res.status(400).json({
          success: false,
          message:
            'titreAlerte, prioriteAlerte et idDeploiement sont requis',
        });
      }

      const deploiement = await prisma.deploiement.findFirst({
        where: { idDeploiement, projet: { idUtilisateur } },
      });
      if (!deploiement) {
        return res
          .status(404)
          .json({ success: false, message: 'Déploiement introuvable' });
      }

      const alerte = await prisma.alerte.create({
        data: {
          titreAlerte,
          prioriteAlerte,
          idDeploiement,
          dateAlerte: new Date().toISOString(),
          validationAlerte: Boolean(validationAlerte ?? false),
          alerteResolu: Boolean(alerteResolu ?? false),
        },
      });

      const body: RequestResponse<typeof alerte> = {
        success: true,
        message: 'Alerte créée avec succès',
        data: alerte,
      };
      return res.status(201).json(body);
    } catch (error) {
      return res
        .status(500)
        .json({ success: false, message: 'Erreur interne du serveur' });
    }
  }

  
  async update(req: Request, res: Response): Promise<Response> {
    try {
      const idUtilisateur = req.currentUser!.userId; // garanti par authMiddleware
      const { idAlerte } = req.params;
      const {
        titreAlerte,
        prioriteAlerte,
        validationAlerte,
        alerteResolu,
      } = req.body ?? {};

      const existing = await prisma.alerte.findFirst({
        where: { idAlerte: idAlerte!, deploiement: { projet: { idUtilisateur } } },
      });
      if (!existing) {
        return res
          .status(404)
          .json({ success: false, message: 'Alerte introuvable' });
      }

      const data: any = {};
      if (titreAlerte !== undefined) data.titreAlerte = titreAlerte;
      if (prioriteAlerte !== undefined) data.prioriteAlerte = prioriteAlerte;
      if (validationAlerte !== undefined)
        data.validationAlerte = Boolean(validationAlerte);
      if (alerteResolu !== undefined)
        data.alerteResolu = Boolean(alerteResolu);

      if (Object.keys(data).length === 0) {
        return res
          .status(400)
          .json({ success: false, message: 'Aucun champ à mettre à jour' });
      }

      const alerte = await prisma.alerte.update({
        where: { idAlerte: idAlerte! },
        data,
      });

      const body: RequestResponse<typeof alerte> = {
        success: true,
        message: 'Alerte mise à jour',
        data: alerte,
      };
      return res.status(200).json(body);
    } catch (error) {
      return res
        .status(500)
        .json({ success: false, message: 'Erreur interne du serveur' });
    }
  }

  
  async remove(req: Request, res: Response): Promise<Response> {
    try {
      const idUtilisateur = req.currentUser!.userId; // garanti par authMiddleware
      const { idAlerte } = req.params;

      const existing = await prisma.alerte.findFirst({
        where: { idAlerte: idAlerte!, deploiement: { projet: { idUtilisateur } } },
      });
      if (!existing) {
        return res
          .status(404)
          .json({ success: false, message: 'Alerte introuvable' });
      }

      await prisma.alerte.delete({ where: { idAlerte: idAlerte! } });

      const body: RequestResponse<null> = {
        success: true,
        message: 'Alerte supprimée avec succès',
      };
      return res.status(200).json(body);
    } catch (error) {
      return res
        .status(500)
        .json({ success: false, message: 'Erreur interne du serveur' });
    }
  }
}