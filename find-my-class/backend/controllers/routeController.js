import Route from '../models/Route.js';

export const list = async (req, res) => {
  const { startLocation, endLocation } = req.query;
  const filter = {};
  if (startLocation) filter.startLocation = startLocation;
  if (endLocation) filter.endLocation = endLocation;
  const routes = await Route.find(filter)
    .populate('startLocation', 'roomNumber floor coordinates buildingId')
    .populate('endLocation', 'roomNumber floor coordinates buildingId')
    .sort({ createdAt: -1 })
    .lean();
  res.json(routes);
};

export const create = async (req, res) => {
  const route = await Route.create(req.body);
  const populated = await Route.findById(route._id)
    .populate('startLocation', 'roomNumber floor coordinates buildingId')
    .populate('endLocation', 'roomNumber floor coordinates buildingId');
  res.status(201).json(populated);
};
