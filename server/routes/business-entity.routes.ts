import type { Express } from 'express';
import { z } from 'zod';
import * as ProjectRepo from '../storage/project.repository';
import * as CostCenterRepo from '../storage/cost-center.repository';
import * as ClientRepo from '../storage/client.repository';
import { validateAccountOwnership } from '../middleware/account-ownership';
import { insertProjectSchema, insertCostCenterSchema, insertClientSchema } from '@shared/schema';
import logger from '../lib/logger';

export function registerBusinessEntityRoutes(app: Express) {
  // Project routes
  app.get('/api/accounts/:accountId/projects', validateAccountOwnership, async (req, res) => {
    try {
      const accountId = parseInt(req.params.accountId);
      const projects = await ProjectRepo.getProjects(accountId);
      res.json(projects);
    } catch (error) {
      logger.error({ err: error }, 'GET /api/accounts/:accountId/projects');
      res.status(500).json({ message: 'Failed to fetch projects' });
    }
  });

  app.get('/api/projects/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const project = await ProjectRepo.getProject(id);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      res.json(project);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch project' });
    }
  });

  app.get('/api/projects/:id/stats', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const stats = await ProjectRepo.getProjectStats(id);
      if (!stats) {
        return res.status(404).json({ message: 'Project not found' });
      }
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch project stats' });
    }
  });

  app.post('/api/accounts/:accountId/projects', validateAccountOwnership, async (req, res) => {
    try {
      const accountId = parseInt(req.params.accountId);
      const validatedData = insertProjectSchema.parse({ ...req.body, accountId });
      const project = await ProjectRepo.createProject(validatedData);
      res.status(201).json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Invalid project data', errors: error.errors });
      } else {
        res.status(500).json({ message: 'Failed to create project' });
      }
    }
  });

  app.patch('/api/projects/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertProjectSchema.partial().parse(req.body);
      const project = await ProjectRepo.updateProject(id, validatedData);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      res.json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Invalid project data', errors: error.errors });
      } else {
        res.status(500).json({ message: 'Failed to update project' });
      }
    }
  });

  app.delete('/api/projects/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await ProjectRepo.deleteProject(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete project' });
    }
  });

  // Cost Center routes
  app.get('/api/accounts/:accountId/cost-centers', validateAccountOwnership, async (req, res) => {
    try {
      const accountId = parseInt(req.params.accountId);
      const costCenters = await CostCenterRepo.getCostCenters(accountId);
      res.json(costCenters);
    } catch (error) {
      logger.error({ err: error }, 'GET /api/accounts/:accountId/cost-centers');
      res.status(500).json({ message: 'Failed to fetch cost centers' });
    }
  });

  app.get('/api/cost-centers/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const costCenter = await CostCenterRepo.getCostCenter(id);
      if (!costCenter) {
        return res.status(404).json({ message: 'Cost center not found' });
      }
      res.json(costCenter);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch cost center' });
    }
  });

  app.get('/api/cost-centers/:id/stats', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const stats = await CostCenterRepo.getCostCenterStats(id);
      if (!stats) {
        return res.status(404).json({ message: 'Cost center not found' });
      }
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch cost center stats' });
    }
  });

  app.post('/api/accounts/:accountId/cost-centers', validateAccountOwnership, async (req, res) => {
    try {
      const accountId = parseInt(req.params.accountId);
      const validatedData = insertCostCenterSchema.parse({ ...req.body, accountId });
      const costCenter = await CostCenterRepo.createCostCenter(validatedData);
      res.status(201).json(costCenter);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Invalid cost center data', errors: error.errors });
      } else {
        res.status(500).json({ message: 'Failed to create cost center' });
      }
    }
  });

  app.patch('/api/cost-centers/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertCostCenterSchema.partial().parse(req.body);
      const costCenter = await CostCenterRepo.updateCostCenter(id, validatedData);
      if (!costCenter) {
        return res.status(404).json({ message: 'Cost center not found' });
      }
      res.json(costCenter);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Invalid cost center data', errors: error.errors });
      } else {
        res.status(500).json({ message: 'Failed to update cost center' });
      }
    }
  });

  app.delete('/api/cost-centers/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await CostCenterRepo.deleteCostCenter(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete cost center' });
    }
  });

  // Client routes
  app.get('/api/accounts/:accountId/clients', validateAccountOwnership, async (req, res) => {
    try {
      const accountId = parseInt(req.params.accountId);
      const clients = await ClientRepo.getClients(accountId);
      res.json(clients);
    } catch (error) {
      logger.error({ err: error }, 'GET /api/accounts/:accountId/clients');
      res.status(500).json({ message: 'Failed to fetch clients' });
    }
  });

  app.get('/api/clients/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const client = await ClientRepo.getClient(id);
      if (!client) {
        return res.status(404).json({ message: 'Client not found' });
      }
      res.json(client);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch client' });
    }
  });

  app.get('/api/clients/:id/with-projects', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const clientWithProjects = await ClientRepo.getClientWithProjects(id);
      if (!clientWithProjects) {
        return res.status(404).json({ message: 'Client not found' });
      }
      res.json(clientWithProjects);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch client with projects' });
    }
  });

  app.post('/api/accounts/:accountId/clients', validateAccountOwnership, async (req, res) => {
    try {
      const accountId = parseInt(req.params.accountId);
      const validatedData = insertClientSchema.parse({ ...req.body, accountId });
      const client = await ClientRepo.createClient(validatedData);
      res.status(201).json(client);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Invalid client data', errors: error.errors });
      } else {
        res.status(500).json({ message: 'Failed to create client' });
      }
    }
  });

  app.patch('/api/clients/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertClientSchema.partial().parse(req.body);
      const client = await ClientRepo.updateClient(id, validatedData);
      if (!client) {
        return res.status(404).json({ message: 'Client not found' });
      }
      res.json(client);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Invalid client data', errors: error.errors });
      } else {
        res.status(500).json({ message: 'Failed to update client' });
      }
    }
  });

  app.delete('/api/clients/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await ClientRepo.deleteClient(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete client' });
    }
  });
}
