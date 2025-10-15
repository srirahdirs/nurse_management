import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import './index.css';

const API_BASE_URL = 'http://localhost:5000/api';

const App = () => {
    const [nurses, setNurses] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingNurse, setEditingNurse] = useState(null);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const [showConfirmDelete, setShowConfirmDelete] = useState(false);
    const [nurseToDelete, setNurseToDelete] = useState(null);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(5);

    const [formData, setFormData] = useState({
        name: '',
        license_number: '',
        dob: '',
        age: ''
    });

    const fetchNurses = async () => {
        setLoading(true);
        try {
            const response = await axios.get(`${API_BASE_URL}/nurses`);
            setNurses(response.data.data);
        } catch (error) {
            showMessage('error', 'Error fetching nurses: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNurses();
    }, []);

    // Reset to first page when sort changes
    useEffect(() => {
        setCurrentPage(1);
    }, [sortConfig]);

    const calculateAge = (dob) => {
        const birthDate = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();

        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }

        return age;
    };

    // Get maximum date (18 years ago from today) - Nurses must be 18+
    const getMaxDate = () => {
        const today = new Date();
        const maxDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
        return maxDate.toISOString().split('T')[0];
    };

    // Handle form input changes
    const handleInputChange = (e) => {
        const { name, value } = e.target;

        if (name === 'dob') {
            const age = calculateAge(value);
            setFormData(prev => ({
                ...prev,
                [name]: value,
                age: age
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                [name]: value
            }));
        }
    };

    // Show message using Promise
    const showMessage = (type, text) => {
        return new Promise((resolve) => {
            setMessage({ type, text });
            setTimeout(() => {
                setMessage({ type: '', text: '' });
                resolve();
            }, 3000);
        });
    };

    // Open modal for adding new nurse
    const handleAddClick = () => {
        setEditingNurse(null);
        setFormData({
            name: '',
            license_number: '',
            dob: '',
            age: ''
        });
        setShowModal(true);
    };

    // Open modal for editing nurse
    const handleEditClick = (nurse) => {
        setEditingNurse(nurse);
        setFormData({
            name: nurse.name,
            license_number: nurse.license_number,
            dob: nurse.dob.split('T')[0], // Format date for input
            age: nurse.age
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (formData.age < 18) {
            showMessage('error', 'Nurse must be at least 18 years old!');
            return;
        }

        setShowModal(false);
        try {
            if (editingNurse) {
                await axios.put(`${API_BASE_URL}/nurses/${editingNurse.id}`, formData);
                await showMessage('success', 'Nurse updated successfully!');
            } else {
                await axios.post(`${API_BASE_URL}/nurses`, formData);
                await showMessage('success', 'Nurse added successfully!');
            }

            fetchNurses();
        } catch (error) {
            showMessage('error', error.response?.data?.message || 'Error saving nurse');
        }
    };

    // Open delete confirmation modal
    const handleDeleteClick = (nurse) => {
        setNurseToDelete(nurse);
        setShowConfirmDelete(true);
    };

    // Confirm and delete nurse using Promise
    const confirmDelete = () => {
        setShowConfirmDelete(false);

        axios.delete(`${API_BASE_URL}/nurses/${nurseToDelete.id}`)
            .then(() => {
                return showMessage('success', 'Nurse deleted successfully!');
            })
            .then(() => {
                fetchNurses();
                setNurseToDelete(null);
            })
            .catch(error => {
                showMessage('error', error.response?.data?.message || 'Error deleting nurse');
                setNurseToDelete(null);
            });
    };

    // Cancel delete
    const cancelDelete = () => {
        setShowConfirmDelete(false);
        setNurseToDelete(null);
    };

    // Sorting functionality
    const handleSort = (key) => {
        let direction = 'asc';

        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }

        setSortConfig({ key, direction });
    };

    // Get sorted data
    const getSortedNurses = () => {
        if (!sortConfig.key) return nurses;

        return [...nurses].sort((a, b) => {
            const aValue = a[sortConfig.key];
            const bValue = b[sortConfig.key];

            if (aValue < bValue) {
                return sortConfig.direction === 'asc' ? -1 : 1;
            }
            if (aValue > bValue) {
                return sortConfig.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
    };

    // Download as Excel (XLSX)
    const downloadExcel = () => {
        const worksheet = XLSX.utils.json_to_sheet(
            nurses.map(nurse => ({
                'ID': nurse.id,
                'Name': nurse.name,
                'License Number': nurse.license_number,
                'Date of Birth': nurse.dob.split('T')[0],
                'Age': nurse.age
            }))
        );

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Nurses');
        XLSX.writeFile(workbook, `nurses_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    // Download as CSV
    const downloadCSV = () => {
        const worksheet = XLSX.utils.json_to_sheet(
            nurses.map(nurse => ({
                'ID': nurse.id,
                'Name': nurse.name,
                'License Number': nurse.license_number,
                'Date of Birth': nurse.dob.split('T')[0],
                'Age': nurse.age
            }))
        );

        const csv = XLSX.utils.sheet_to_csv(worksheet);
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `nurses_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    const sortedNurses = getSortedNurses();

    // Pagination calculations
    const totalPages = Math.ceil(sortedNurses.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentNurses = sortedNurses.slice(indexOfFirstItem, indexOfLastItem);

    // Pagination handlers
    const handlePageChange = (pageNumber) => {
        setCurrentPage(pageNumber);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleItemsPerPageChange = (value) => {
        setItemsPerPage(Number(value));
        setCurrentPage(1);
    };

    return (
        <div className="container">
            <div className="main-content">
                {/* Header */}
                <div className="header">
                    <div className="header-content">
                        <h1>
                            <span className="header-icon">🏥</span>
                            Nurse Management System
                        </h1>
                        <p>Manage nurse records efficiently with modern interface</p>
                    </div>
                </div>

                <div className="content-area">
                    {/* Message Display */}
                    {message.text && (
                        <div className={`message message-${message.type}`}>
                            <span>{message.type === 'success' ? '✓' : '✕'}</span>
                            {message.text}
                        </div>
                    )}

                    {/* Stats */}
                    <div className="stats-container">
                        <div className="stat-card">
                            <div className="stat-card-content">
                                <h3>{nurses.length}</h3>
                                <p>Total Nurses</p>
                            </div>
                        </div>
                    </div>

                    {/* Actions Bar */}
                    <div className="actions-bar">
                        <button className="btn btn-primary" onClick={handleAddClick}>
                            <span>➕</span>
                            Add New Nurse
                        </button>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button className="btn btn-success" onClick={downloadExcel} disabled={nurses.length === 0}>
                                <span>📥</span>
                                Download Excel
                            </button>
                            <button className="btn btn-success" onClick={downloadCSV} disabled={nurses.length === 0}>
                                <span>📥</span>
                                Download CSV
                            </button>
                        </div>
                    </div>

                    {/* Nurses Table */}
                    {loading ? (
                        <div className="loading">
                            <div className="spinner"></div>
                            Loading nurses...
                        </div>
                    ) : nurses.length === 0 ? (
                        <div className="empty-state">
                            <div style={{ fontSize: '4rem', marginBottom: '20px' }}>👩‍⚕️</div>
                            <h3>No nurses found</h3>
                            <p>Click "Add New Nurse" to get started</p>
                        </div>
                    ) : (
                        <>
                            <div className="table-scroll-indicator">
                                👉 Swipe left to see more →
                            </div>
                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th
                                                className={`sortable ${sortConfig.key === 'name' ? sortConfig.direction : ''}`}
                                                onClick={() => handleSort('name')}
                                            >
                                                Name
                                            </th>
                                            <th
                                                className={`sortable ${sortConfig.key === 'license_number' ? sortConfig.direction : ''}`}
                                                onClick={() => handleSort('license_number')}
                                            >
                                                License Number
                                            </th>
                                            <th
                                                className={`sortable ${sortConfig.key === 'dob' ? sortConfig.direction : ''}`}
                                                onClick={() => handleSort('dob')}
                                            >
                                                Date of Birth
                                            </th>
                                            <th
                                                className={`sortable ${sortConfig.key === 'age' ? sortConfig.direction : ''}`}
                                                onClick={() => handleSort('age')}
                                            >
                                                Age
                                            </th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {currentNurses.map((nurse, index) => (
                                            <tr key={nurse.id}>
                                                <td>{indexOfFirstItem + index + 1}</td>
                                                <td>{nurse.name}</td>
                                                <td>{nurse.license_number}</td>
                                                <td>{new Date(nurse.dob).toLocaleDateString()}</td>
                                                <td>{nurse.age}</td>
                                                <td>
                                                    <div className="action-buttons">
                                                        <button
                                                            className="btn btn-warning btn-small"
                                                            onClick={() => handleEditClick(nurse)}
                                                        >
                                                            ✏️ Edit
                                                        </button>
                                                        <button
                                                            className="btn btn-danger btn-small"
                                                            onClick={() => handleDeleteClick(nurse)}
                                                        >
                                                            🗑️ Delete
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}

                    {/* Pagination Controls */}
                    {!loading && nurses.length > 0 && (
                        <div className="pagination-container">
                            <div className="pagination-info">
                                <label>
                                    Show
                                    <select value={itemsPerPage} onChange={(e) => handleItemsPerPageChange(e.target.value)}>
                                        <option value="5">5</option>
                                        <option value="10">10</option>
                                        <option value="15">15</option>
                                        <option value="20">20</option>
                                        <option value="50">50</option>
                                    </select>
                                    entries
                                </label>
                                <span className="pagination-summary">
                                    Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, nurses.length)} of {nurses.length} nurses
                                </span>
                            </div>

                            <div className="pagination-controls">
                                <button
                                    className="pagination-btn"
                                    onClick={() => handlePageChange(currentPage - 1)}
                                    disabled={currentPage === 1}
                                >
                                    ← Previous
                                </button>

                                <div className="pagination-numbers">
                                    {[...Array(totalPages)].map((_, index) => {
                                        const pageNumber = index + 1;
                                        // Show first page, last page, current page, and pages around current
                                        if (
                                            pageNumber === 1 ||
                                            pageNumber === totalPages ||
                                            (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
                                        ) {
                                            return (
                                                <button
                                                    key={pageNumber}
                                                    className={`pagination-number ${currentPage === pageNumber ? 'active' : ''}`}
                                                    onClick={() => handlePageChange(pageNumber)}
                                                >
                                                    {pageNumber}
                                                </button>
                                            );
                                        } else if (
                                            pageNumber === currentPage - 2 ||
                                            pageNumber === currentPage + 2
                                        ) {
                                            return <span key={pageNumber} className="pagination-ellipsis">...</span>;
                                        }
                                        return null;
                                    })}
                                </div>

                                <button
                                    className="pagination-btn"
                                    onClick={() => handlePageChange(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                >
                                    Next →
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Add/Edit Modal */}
                    {showModal && (
                        <div className="modal-overlay" onClick={() => setShowModal(false)}>
                            <div className="modal" onClick={(e) => e.stopPropagation()}>
                                <h2>{editingNurse ? 'Edit Nurse' : 'Add New Nurse'}</h2>

                                <form onSubmit={handleSubmit}>
                                    <div className="form-group">
                                        <label>Name *</label>
                                        <input
                                            type="text"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleInputChange}
                                            required
                                            placeholder="Enter nurse name"
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>License Number *</label>
                                        <input
                                            type="text"
                                            name="license_number"
                                            value={formData.license_number}
                                            onChange={handleInputChange}
                                            required
                                            placeholder="e.g., LN123456"
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Date of Birth * <span style={{ fontSize: '12px', color: '#666' }}>(Must be 18+ years old)</span></label>
                                        <input
                                            type="date"
                                            name="dob"
                                            value={formData.dob}
                                            onChange={handleInputChange}
                                            max={getMaxDate()}
                                            required
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Age</label>
                                        <input
                                            type="number"
                                            name="age"
                                            value={formData.age}
                                            disabled
                                            placeholder="Auto-calculated"
                                        />
                                    </div>

                                    <div className="modal-actions">
                                        <button type="button" className="btn btn-danger" onClick={() => setShowModal(false)}>
                                            Cancel
                                        </button>
                                        <button type="submit" className="btn btn-primary">
                                            {editingNurse ? 'Update' : 'Add'} Nurse
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* Delete Confirmation Modal */}
                    {showConfirmDelete && nurseToDelete && (
                        <div className="modal-overlay" onClick={cancelDelete}>
                            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
                                <div style={{ textAlign: 'center' }}>
                                    {/* Warning Icon */}
                                    <div style={{
                                        width: '80px',
                                        height: '80px',
                                        margin: '0 auto 20px',
                                        background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '3rem',
                                        animation: 'pulse 1.5s infinite'
                                    }}>
                                        ⚠️
                                    </div>

                                    <h2 style={{ color: '#e74c3c', marginBottom: '15px' }}>Delete Nurse?</h2>

                                    <p style={{ color: '#666', marginBottom: '20px', fontSize: '1.1rem' }}>
                                        Are you sure you want to delete this nurse?
                                    </p>

                                    {/* Nurse Details */}
                                    <div style={{
                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                        color: 'white',
                                        padding: '20px',
                                        borderRadius: '12px',
                                        marginBottom: '25px'
                                    }}>
                                        <p style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '8px' }}>
                                            {nurseToDelete.name}
                                        </p>
                                        <p style={{ opacity: 0.9, fontSize: '0.95rem' }}>
                                            License: {nurseToDelete.license_number}
                                        </p>
                                        <p style={{ opacity: 0.9, fontSize: '0.95rem' }}>
                                            Age: {nurseToDelete.age} years
                                        </p>
                                    </div>

                                    <p style={{
                                        color: '#e74c3c',
                                        fontWeight: '600',
                                        marginBottom: '25px',
                                        fontSize: '0.95rem'
                                    }}>
                                        ⚠️ This action cannot be undone!
                                    </p>

                                    {/* Action Buttons */}
                                    <div className="modal-actions">
                                        <button
                                            type="button"
                                            className="btn btn-primary"
                                            onClick={cancelDelete}
                                            style={{ flex: 1 }}
                                        >
                                            ✖️ Cancel
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-danger"
                                            onClick={confirmDelete}
                                            style={{ flex: 1 }}
                                        >
                                            🗑️ Yes, Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default App;

