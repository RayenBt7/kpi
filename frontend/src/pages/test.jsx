import React from "react";
import { useState, useEffect } from "react";

import api from '../services/api';




function Test() {
	const [users, setUsers] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [responsables, setResponsables] = useState([]);
	const [indicateurs, setIndicateurs] = useState([]);
	
  useEffect(() => {
    fetchUsers();
  }, []);
  useEffect(()=> {
	fetchResponsables();
  }, []);
  useEffect(() => {
	fetchIndicateurs();

  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/api/admin/users');
      setUsers(response.data.users);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const fetchResponsables = async() =>{
	try {
		setLoading(true);
		setError('');
		const response = await api.get('/api/responsables');
		setResponsables(response.data || []);}
		catch (err) {
			setError(err.response?.data?.error || 'Failed to fetch responsables');
		} finally {
			setLoading(false);
		}
  };

  const fetchIndicateurs = async() => {
	try {
		setLoading(true);
		setError('');
		const response = await api.get('/api/indicateurs');
		setIndicateurs(response.data || []);}
		catch (err) {
			setError(err.response?.data?.error || 'Failed to fetch indicateurs');
		} finally {
			setLoading(false);
		}	
  };
	  return (
		< >
			{loading && <p>Loading users...</p>}
			{error && <p style={{ color: 'red' }}>{error}</p>}
			<h1 style={{ marginTop: '60px' }}>hello from test page</h1>
			<h2>list of Users</h2>
			<ul>
				{users.map(user => (
					<li key={user.id}>{user.username}</li>
				))}
			</ul>
			<h2>list of Indicateurs </h2>
			<ul>
				{indicateurs.map(indicateur => (
					<li key={indicateur.Norder}>{indicateur.Designation} - {indicateur.trend}</li>
					
				))}
			</ul>
			<h2>list of Responsables </h2>
			<ul>
				{responsables.map(responsable => (
					<li key={responsable.code_responsable}>{responsable.responsable}</li>
				))}
			</ul>
			

			
		</>
	  );
}
export default Test;