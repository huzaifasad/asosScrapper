'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Search, Package, Loader2, Download, Filter, Grid, SlidersHorizontal, Tag, User, Box, DollarSign, CheckCircle, XCircle, Info, AlertCircle, Database, Check, Image as ImageIcon, Maximize2, Store, Plus, Trash2, Globe, Eye, X } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// Default Shopify stores
const DEFAULT_STORES = [
  { name: 'French Connection', url: 'https://www.frenchconnection.com', active: true },
//   { name: 'Gymshark', url: 'https://www.gymshark.com', active: false },
  { name: 'Allbirds', url: 'https://www.allbirds.com', active: false },
//   { name: 'Fashion Nova', url: 'https://www.fashionnova.com', active: false },
];

export default function DynamicShopifyScraper() {
  // Store Management - Fixed hydration issue by initializing with DEFAULT_STORES
  const [stores, setStores] = useState(DEFAULT_STORES);
  const [currentStore, setCurrentStore] = useState(DEFAULT_STORES[0]);
  const [showAddStore, setShowAddStore] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreUrl, setNewStoreUrl] = useState('');
  
  // State Management
  const [collections, setCollections] = useState([]);
  const [selectedCollection, setSelectedCollection] = useState('');
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [productsPerPage] = useState(24);
  const [scrapingAll, setScrapingAll] = useState(false);
  
  // Selection & Database States
  const [selectedProducts, setSelectedProducts] = useState(new Set());
  const [uploadingToDb, setUploadingToDb] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [uploadResults, setUploadResults] = useState({ success: 0, failed: 0, skipped: 0 });
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedProductImages, setSelectedProductImages] = useState(null);
  
  // Quick View State
  const [quickViewProduct, setQuickViewProduct] = useState(null);
  const [showQuickView, setShowQuickView] = useState(false);
  
  // Filter States
  const [filters, setFilters] = useState({
    vendor: '',
    productType: '',
    tag: '',
    priceMin: '',
    priceMax: '',
    availability: 'all',
    searchQuery: ''
  });
  
  // Metadata States
  const [vendors, setVendors] = useState([]);
  const [productTypes, setProductTypes] = useState([]);
  const [tags, setTags] = useState([]);
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalCollections: 0,
    avgPrice: 0,
    inStock: 0,
    outOfStock: 0
  });

  // Load stores from localStorage after mount (client-side only)
  useEffect(() => {
    const saved = localStorage.getItem('shopify_stores');
    if (saved) {
      const parsedStores = JSON.parse(saved);
      setStores(parsedStores);
      const activeStore = parsedStores.find(s => s.active) || parsedStores[0];
      setCurrentStore(activeStore);
    }
  }, []);

  // Save stores to localStorage
  useEffect(() => {
    localStorage.setItem('shopify_stores', JSON.stringify(stores));
  }, [stores]);

  // Fetch Collections when store changes
  useEffect(() => {
    if (currentStore) {
      fetchCollections();
      setSelectedCollection('');
      setAllProducts([]);
      setSelectedProducts(new Set());
    }
  }, [currentStore]);

  // Add new store
  const addStore = () => {
    if (!newStoreName || !newStoreUrl) {
      alert('Please enter both store name and URL');
      return;
    }

    try {
      const url = new URL(newStoreUrl);
      const newStore = {
        name: newStoreName,
        url: url.origin,
        active: false
      };

      setStores([...stores, newStore]);
      setNewStoreName('');
      setNewStoreUrl('');
      setShowAddStore(false);
      alert(`Store "${newStoreName}" added successfully!`);
    } catch (err) {
      alert('Invalid URL format. Please enter a valid URL (e.g., https://example.com)');
    }
  };

  // Delete store
  const deleteStore = (index) => {
    if (confirm(`Delete store "${stores[index].name}"?`)) {
      const newStores = stores.filter((_, i) => i !== index);
      setStores(newStores);
      if (currentStore === stores[index]) {
        setCurrentStore(newStores[0]);
      }
    }
  };

  // Switch store
  const switchStore = (store) => {
    setCurrentStore(store);
    setStores(stores.map(s => ({ ...s, active: s.url === store.url })));
  };

  const fetchCollections = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fetch(`${currentStore.url}/collections.json`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.collections) {
        setCollections(data.collections);
        setStats(prev => ({ ...prev, totalCollections: data.collections.length }));
      } else {
        setError('No collections found. This might not be a Shopify store.');
      }
    } catch (err) {
      setError(`Failed to fetch collections: ${err.message}`);
      setCollections([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCollectionProducts = async (handle, pageNum = 1) => {
    if (!handle) return [];
    
    try {
      const limit = 250;
      const url = `${currentStore.url}/collections/${handle}/products.json?limit=${limit}&page=${pageNum}`;
      const response = await fetch(url);
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      return data.products || [];
    } catch (err) {
      console.error(`Error fetching page ${pageNum}:`, err);
      return [];
    }
  };

  const scrapeAllCollectionProducts = async (handle) => {
    setScrapingAll(true);
    setError('');
    let allProds = [];
    let page = 1;
    let hasMore = true;

    try {
      while (hasMore) {
        const prods = await fetchCollectionProducts(handle, page);
        
        if (prods.length === 0) {
          hasMore = false;
        } else {
          allProds = [...allProds, ...prods];
          
          if (prods.length < 250) {
            hasMore = false;
          }
          
          page++;
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      return allProds;
    } catch (err) {
      setError('Error during full scrape: ' + err.message);
      return allProds;
    } finally {
      setScrapingAll(false);
    }
  };

  const handleCollectionSelect = async (handle) => {
    setSelectedCollection(handle);
    setCurrentPage(1);
    setLoading(true);
    setError('');
    setSelectedProducts(new Set());
    
    try {
      const prods = await scrapeAllCollectionProducts(handle);
      setAllProducts(prods);
      
      extractMetadata(prods);
      calculateStats(prods);
      
    } catch (err) {
      setError('Failed to load products: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const extractMetadata = (prods) => {
    const vendorSet = new Set();
    const typeSet = new Set();
    const tagSet = new Set();
    
    prods.forEach(p => {
      if (p.vendor) vendorSet.add(p.vendor);
      if (p.product_type) typeSet.add(p.product_type);
      if (p.tags) {
        if (Array.isArray(p.tags)) {
          p.tags.forEach(t => tagSet.add(t));
        } else if (typeof p.tags === 'string') {
          p.tags.split(',').forEach(t => tagSet.add(t.trim()));
        }
      }
    });
    
    setVendors(Array.from(vendorSet).sort());
    setProductTypes(Array.from(typeSet).sort());
    setTags(Array.from(tagSet).sort());
  };

  const calculateStats = (prods) => {
    let totalPrice = 0;
    let inStock = 0;
    let outOfStock = 0;
    
    prods.forEach(p => {
      if (p.variants && p.variants.length > 0) {
        const variant = p.variants[0];
        if (variant.price) {
          totalPrice += parseFloat(variant.price);
        }
        if (variant.available) {
          inStock++;
        } else {
          outOfStock++;
        }
      }
    });
    
    setStats({
      totalProducts: prods.length,
      totalCollections: collections.length,
      avgPrice: prods.length > 0 ? (totalPrice / prods.length).toFixed(2) : 0,
      inStock,
      outOfStock
    });
  };

  const filteredProducts = useMemo(() => {
    let filtered = [...allProducts];
    
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.title?.toLowerCase().includes(query) ||
        p.vendor?.toLowerCase().includes(query) ||
        p.product_type?.toLowerCase().includes(query)
      );
    }
    
    if (filters.vendor) {
      filtered = filtered.filter(p => p.vendor === filters.vendor);
    }
    
    if (filters.productType) {
      filtered = filtered.filter(p => p.product_type === filters.productType);
    }
    
    if (filters.tag) {
      filtered = filtered.filter(p => {
        if (Array.isArray(p.tags)) {
          return p.tags.includes(filters.tag);
        } else if (typeof p.tags === 'string') {
          return p.tags.split(',').map(t => t.trim()).includes(filters.tag);
        }
        return false;
      });
    }
    
    if (filters.priceMin || filters.priceMax) {
      filtered = filtered.filter(p => {
        if (!p.variants || p.variants.length === 0) return false;
        const price = parseFloat(p.variants[0].price);
        if (filters.priceMin && price < parseFloat(filters.priceMin)) return false;
        if (filters.priceMax && price > parseFloat(filters.priceMax)) return false;
        return true;
      });
    }
    
    if (filters.availability !== 'all') {
      filtered = filtered.filter(p => {
        if (!p.variants || p.variants.length === 0) return false;
        const available = p.variants[0].available;
        return filters.availability === 'in-stock' ? available : !available;
      });
    }
    
    return filtered;
  }, [allProducts, filters]);

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * productsPerPage;
    const endIndex = startIndex + productsPerPage;
    return filteredProducts.slice(startIndex, endIndex);
  }, [filteredProducts, currentPage, productsPerPage]);

  const totalPages = Math.ceil(filteredProducts.length / productsPerPage);

  const resetFilters = () => {
    setFilters({
      vendor: '',
      productType: '',
      tag: '',
      priceMin: '',
      priceMax: '',
      availability: 'all',
      searchQuery: ''
    });
    setCurrentPage(1);
  };

  const toggleProductSelection = (productId) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedProducts(newSelected);
  };

  const selectAllOnPage = () => {
    const newSelected = new Set(selectedProducts);
    paginatedProducts.forEach(p => newSelected.add(p.id));
    setSelectedProducts(newSelected);
  };

  const selectAllFiltered = () => {
    const newSelected = new Set();
    filteredProducts.forEach(p => newSelected.add(p.id));
    setSelectedProducts(newSelected);
  };

  const deselectAll = () => {
    setSelectedProducts(new Set());
  };

  const openQuickView = (product) => {
    setQuickViewProduct(product);
    setShowQuickView(true);
  };

  const closeQuickView = () => {
    setShowQuickView(false);
    setQuickViewProduct(null);
  };

  const transformProductForDB = (product) => {
    const variant = product.variants?.[0] || {};
    const allVariants = product.variants || [];
    
    const sizes = allVariants.map(v => v.title || v.option1).filter(Boolean);
    const images = product.images?.map(img => img.src) || [];
    
    let tagsArray = [];
    if (Array.isArray(product.tags)) {
      tagsArray = product.tags;
    } else if (typeof product.tags === 'string') {
      tagsArray = product.tags.split(',').map(t => t.trim());
    }
    
    const productUrl = `${currentStore.url}/products/${product.handle}`;
    
    const stripHtml = (html) => {
      if (!html) return '';
      return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    };
    
    const toJsonbArray = (arr) => {
      if (!arr || arr.length === 0) return null;
      return arr.map(item => JSON.stringify(item));
    };
    
    return {
      p_id: null,
      p_product_name: product.title || 'Untitled Product',
      p_price: variant.price ? parseFloat(variant.price) : 0,
      p_colour: tagsArray.find(t => t.toLowerCase().includes('color') || t.toLowerCase().includes('colour')) || null,
      p_description: stripHtml(product.body_html) || null,
      p_size: sizes.length > 0 ? sizes : ['One Size'],
      p_materials: product.body_html ? toJsonbArray([{ description: stripHtml(product.body_html) }]) : null,
      p_availability: variant.available || false,
      p_category_id: null,
      p_product_id: product.id ? parseInt(product.id) : Math.floor(Math.random() * 1000000000),
      p_colour_code: null,
      p_section: selectedCollection || null,
      p_product_family: product.product_type || null,
      p_product_family_en: product.product_type || null,
      p_product_subfamily: null,
      p_care: null,
      p_materials_description: stripHtml(product.body_html) || null,
      p_dimension: variant.weight ? `${variant.weight} ${variant.weight_unit}` : null,
      p_low_on_stock: (variant.inventory_quantity !== undefined && variant.inventory_quantity < 5) || false,
      p_sku: variant.sku || null,
      p_url: productUrl,
      p_currency: 'USD',
      p_image: images.length > 0 ? JSON.stringify(images.map(url => ({ url }))) : null,
      p_you_may_also_like: null,
      p_category_path: selectedCollection || null,
      p_scraped_category: product.product_type || null,
      p_scrape_type: currentStore.name,
      p_brand: product.vendor || currentStore.name,
      p_category: product.product_type || null,
      p_stock_status: variant.available ? 'in_stock' : 'out_of_stock',
      p_color: tagsArray.find(t => t.toLowerCase().includes('color') || t.toLowerCase().includes('colour')) || null,
      p_images: images.length > 0 ? JSON.stringify(images.map(url => ({ url }))) : null,
      p_product_url: productUrl,
      p_care_info: null
    };
  };

  const uploadSelectedToDatabase = async () => {
    if (selectedProducts.size === 0) {
      alert('Please select products to upload');
      return;
    }

    const selectedProds = allProducts.filter(p => selectedProducts.has(p.id));
    
    setUploadingToDb(true);
    setUploadProgress({ current: 0, total: selectedProds.length });
    setUploadResults({ success: 0, failed: 0, skipped: 0 });

    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < selectedProds.length; i++) {
      const product = selectedProds[i];
      setUploadProgress({ current: i + 1, total: selectedProds.length });

      try {
        const dbProduct = transformProductForDB(product);
        
        const { data: insertResult, error: insertError } = await supabase
          .rpc('upsert_zara_product_v6', dbProduct);

        if (insertError) {
          if (insertError.code === '23505' || insertError.message?.includes('duplicate')) {
            console.log(`Product ${product.title} already exists, skipping...`);
            skippedCount++;
          } else {
            console.error(`Failed to upload ${product.title}:`, insertError);
            failedCount++;
          }
        } else {
          console.log(`Successfully uploaded ${product.title}`);
          successCount++;
        }

      } catch (err) {
        console.error(`Error processing ${product.title}:`, err);
        failedCount++;
      }

      setUploadResults({ success: successCount, failed: failedCount, skipped: skippedCount });
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    setUploadingToDb(false);
    alert(`Upload Complete!\n✓ Success: ${successCount}\n⊘ Skipped: ${skippedCount}\n✗ Failed: ${failedCount}`);
  };

  const exportToJSON = () => {
    const dataStr = JSON.stringify(filteredProducts, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentStore.name.replace(/\s+/g, '-')}-products-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToCSV = () => {
    let csv = 'ID,Title,Handle,Vendor,Type,Price,Compare Price,Available,SKU,Tags,Images,Variants,Weight,Inventory\n';
    
    filteredProducts.forEach(p => {
      const variant = p.variants?.[0] || {};
      const tags = Array.isArray(p.tags) ? p.tags.join(';') : (p.tags || '');
      const images = p.images?.map(img => img.src).join(';') || '';
      const variantCount = p.variants?.length || 0;
      
      csv += `${p.id},"${(p.title || '').replace(/"/g, '""')}",${p.handle || ''},${p.vendor || ''},${p.product_type || ''},${variant.price || ''},${variant.compare_at_price || ''},${variant.available || false},${variant.sku || ''},"${tags}","${images}",${variantCount},${variant.weight || ''},${variant.inventory_quantity || 0}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentStore.name.replace(/\s+/g, '-')}-products-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const showImageGallery = (product) => {
    setSelectedProductImages(product);
    setShowImageModal(true);
  };

const ProductCard = ({ product }) => {
  if (!product) return null;
  
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const variant = product.variants?.[0] || {};
  const images = product.images || [];
  const hasDiscount = variant.compare_at_price && parseFloat(variant.compare_at_price) > parseFloat(variant.price);
  const discount = hasDiscount ? (((parseFloat(variant.compare_at_price) - parseFloat(variant.price)) / parseFloat(variant.compare_at_price)) * 100).toFixed(0) : 0;
  const isSelected = selectedProducts.has(product.id);
  
  const nextImage = (e) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };
  
  const prevImage = (e) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };
  
  return (
    <div className={`bg-white shadow-sm overflow-hidden hover:shadow-lg transition-all duration-300 border ${isSelected ? 'border-blue-600 ring-4 ring-blue-100' : 'border-gray-200'}`}>
      <div className="relative h-80 bg-gray-50 group overflow-hidden">
        {images.length > 0 ? (
          <>
            <img 
              src={images[currentImageIndex].src} 
              alt={product.title} 
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
              loading="lazy" 
            />
            
            {images.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-3 top-1/2 -translate-y-1/2 bg-white text-gray-800 p-2.5 opacity-0 group-hover:opacity-100 transition-all hover:bg-gray-100"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                
                <button
                  onClick={nextImage}
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-white text-gray-800 p-2.5 opacity-0 group-hover:opacity-100 transition-all hover:bg-gray-100"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {images.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentImageIndex(idx);
                      }}
                      className={`h-1.5 transition-all ${
                        idx === currentImageIndex 
                          ? 'bg-white w-8' 
                          : 'bg-white bg-opacity-60 hover:bg-opacity-80 w-1.5'
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center"><Package className="w-20 h-20 text-gray-300" /></div>
        )}
        
        {/* Quick View Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            openQuickView(product);
          }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white text-gray-900 px-6 py-3 opacity-0 group-hover:opacity-100 transition-all hover:bg-gray-100 font-semibold flex items-center gap-2 shadow-lg"
        >
          <Eye className="w-5 h-5" /> Quick View
        </button>
        
        <div className="absolute top-4 left-4">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleProductSelection(product.id);
            }}
            className={`w-9 h-9 flex items-center justify-center transition-all ${isSelected ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
          >
            {isSelected && <Check className="w-5 h-5" />}
          </button>
        </div>
        
        {hasDiscount && (
          <div className="absolute top-4 right-4 bg-red-600 text-white px-3 py-1.5 text-sm font-bold">
            {discount}% OFF
          </div>
        )}
        
        {images.length > 1 && (
          <div className="absolute top-16 right-4 bg-black bg-opacity-80 text-white px-2.5 py-1 text-xs font-medium">
            {currentImageIndex + 1} / {images.length}
          </div>
        )}
      </div>
      
      <div className="p-5">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {product.vendor && (
            <span className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1 flex items-center gap-1.5 font-medium">
              <User className="w-3 h-3" /> {product.vendor}
            </span>
          )}
          {product.product_type && (
            <span className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1 flex items-center gap-1.5 font-medium">
              <Box className="w-3 h-3" /> {product.product_type}
            </span>
          )}
        </div>
        
        <h3 className="font-semibold text-gray-900 mb-3 line-clamp-2 leading-snug text-base">{product.title}</h3>
        
        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-2xl font-bold text-gray-900">${variant.price || '0.00'}</span>
          {hasDiscount && (
            <span className="text-sm text-gray-500 line-through">${variant.compare_at_price}</span>
          )}
        </div>
        
        <div className={`mb-4 text-sm px-3 py-1.5 font-medium inline-block ${variant.available ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {variant.available ? 'In Stock' : 'Out of Stock'}
        </div>
        
        <div className="space-y-2 mb-4">
          {variant.sku && (
            <div className="text-xs text-gray-600">
              <span className="font-semibold text-gray-800">SKU:</span> {variant.sku}
            </div>
          )}
          {variant.weight && (
            <div className="text-xs text-gray-600">
              <span className="font-semibold text-gray-800">Weight:</span> {variant.weight} {variant.weight_unit}
            </div>
          )}
          {variant.inventory_quantity !== undefined && (
            <div className="text-xs text-gray-600">
              <span className="font-semibold text-gray-800">Stock:</span> {variant.inventory_quantity} units available
            </div>
          )}
        </div>
        
        {product.tags && product.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {(Array.isArray(product.tags) ? product.tags : product.tags.split(',')).slice(0, 3).map((tag, i) => (
              <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 border border-blue-200 flex items-center gap-1">
                <Tag className="w-3 h-3" /> {typeof tag === 'string' ? tag.trim() : tag}
              </span>
            ))}
          </div>
        )}
        
        <div className="pt-3 border-t border-gray-200 flex justify-between items-center text-xs text-gray-600">
          <span className="font-medium">{product.variants?.length || 0} variant{(product.variants?.length || 0) !== 1 ? 's' : ''}</span>
          <span className="font-medium">{product.images?.length || 0} image{(product.images?.length || 0) !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  );
};

  // Quick View Modal Component
  const QuickViewModal = () => {
    if (!showQuickView || !quickViewProduct) return null;

    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const variant = quickViewProduct.variants?.[0] || {};
    const images = quickViewProduct.images || [];
    const hasDiscount = variant.compare_at_price && parseFloat(variant.compare_at_price) > parseFloat(variant.price);
    const discount = hasDiscount ? (((parseFloat(variant.compare_at_price) - parseFloat(variant.price)) / parseFloat(variant.compare_at_price)) * 100).toFixed(0) : 0;
    
    const stripHtml = (html) => {
      if (!html) return '';
      return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    };

    return (
      <div 
        className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4"
        onClick={closeQuickView}
      >
        <div 
          className="bg-white max-w-6xl w-full max-h-[90vh] overflow-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sticky top-0 bg-white border-b border-gray-300 p-4 flex justify-between items-center z-10">
            <h2 className="text-2xl font-bold text-gray-900">Quick View</h2>
            <button
              onClick={closeQuickView}
              className="text-gray-600 hover:text-gray-900 p-2 hover:bg-gray-100 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-8">
            {/* Image Gallery */}
            <div>
              <div className="bg-gray-100 mb-4">
                {images.length > 0 ? (
                  <img 
                    src={images[currentImageIndex].src} 
                    alt={quickViewProduct.title}
                    className="w-full h-96 object-contain"
                  />
                ) : (
                  <div className="w-full h-96 flex items-center justify-center">
                    <Package className="w-24 h-24 text-gray-300" />
                  </div>
                )}
              </div>
              
              {images.length > 1 && (
                <div className="grid grid-cols-6 gap-2">
                  {images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentImageIndex(idx)}
                      className={`border-2 overflow-hidden ${idx === currentImageIndex ? 'border-blue-600' : 'border-gray-200 hover:border-gray-400'}`}
                    >
                      <img 
                        src={img.src} 
                        alt={`Thumbnail ${idx + 1}`}
                        className="w-full h-16 object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product Details */}
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-4">{quickViewProduct.title}</h1>
              
              <div className="flex items-center gap-3 mb-6">
                {quickViewProduct.vendor && (
                  <span className="text-sm bg-blue-50 text-blue-700 px-3 py-1.5 border border-blue-200 font-medium">
                    {quickViewProduct.vendor}
                  </span>
                )}
                {quickViewProduct.product_type && (
                  <span className="text-sm bg-purple-50 text-purple-700 px-3 py-1.5 border border-purple-200 font-medium">
                    {quickViewProduct.product_type}
                  </span>
                )}
              </div>

              <div className="flex items-baseline gap-3 mb-6">
                <span className="text-4xl font-bold text-gray-900">${variant.price || '0.00'}</span>
                {hasDiscount && (
                  <>
                    <span className="text-xl text-gray-500 line-through">${variant.compare_at_price}</span>
                    <span className="bg-red-600 text-white px-2.5 py-1 text-sm font-bold">
                      {discount}% OFF
                    </span>
                  </>
                )}
              </div>

              <div className={`mb-6 text-base px-4 py-2 font-semibold inline-block ${variant.available ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {variant.available ? '✓ In Stock' : '✗ Out of Stock'}
              </div>

              {quickViewProduct.body_html && (
                <div className="mb-6">
                  <h3 className="font-bold text-gray-900 text-lg mb-2">Description</h3>
                  <p className="text-gray-700 leading-relaxed">{stripHtml(quickViewProduct.body_html)}</p>
                </div>
              )}

              <div className="space-y-3 mb-6 bg-gray-50 p-4 border border-gray-200">
                <h3 className="font-bold text-gray-900 text-lg mb-3">Product Details</h3>
                
                {variant.sku && (
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold text-gray-800">SKU:</span>
                    <span className="text-gray-700">{variant.sku}</span>
                  </div>
                )}
                
                {variant.weight && (
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold text-gray-800">Weight:</span>
                    <span className="text-gray-700">{variant.weight} {variant.weight_unit}</span>
                  </div>
                )}
                
                {variant.inventory_quantity !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold text-gray-800">Available Units:</span>
                    <span className="text-gray-700">{variant.inventory_quantity}</span>
                  </div>
                )}
                
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-gray-800">Variants:</span>
                  <span className="text-gray-700">{quickViewProduct.variants?.length || 0}</span>
                </div>
              </div>

              {quickViewProduct.variants && quickViewProduct.variants.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-bold text-gray-900 text-lg mb-3">Available Variants</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 p-3">
                    {quickViewProduct.variants.map((v, idx) => (
                      <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 border border-gray-200 text-sm">
                        <span className="font-medium text-gray-900">{v.title}</span>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-gray-900">${v.price}</span>
                          <span className={`text-xs px-2 py-1 ${v.available ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {v.available ? 'Available' : 'Sold Out'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {quickViewProduct.tags && quickViewProduct.tags.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-bold text-gray-900 text-lg mb-3">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {(Array.isArray(quickViewProduct.tags) ? quickViewProduct.tags : quickViewProduct.tags.split(',')).map((tag, i) => (
                      <span key={i} className="text-sm bg-blue-50 text-blue-700 px-3 py-1.5 border border-blue-200 flex items-center gap-1.5 font-medium">
                        <Tag className="w-3.5 h-3.5" /> {typeof tag === 'string' ? tag.trim() : tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-6 border-t border-gray-200">
                <button
                  onClick={() => {
                    toggleProductSelection(quickViewProduct.id);
                  }}
                  className={`flex-1 py-3 font-semibold transition-colors ${
                    selectedProducts.has(quickViewProduct.id)
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {selectedProducts.has(quickViewProduct.id) ? 'Remove from Selection' : 'Add to Selection'}
                </button>
                
                <a
                  href={`${currentStore.url}/products/${quickViewProduct.handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3 bg-gray-200 text-gray-900 hover:bg-gray-300 transition-colors font-semibold"
                >
                  View on Store
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white shadow-md p-8 mb-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-5">
              <div className="bg-blue-600 p-4">
                <Globe className="w-10 h-10 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-gray-900">
                  universal shopify echter
                </h1>
                <p className="text-gray-600 mt-2">Fetch any Shopify store and add unlimited stores dynamically</p>
              </div>
            </div>
          </div>
        </div>

        {/* Store Management */}
        <div className="bg-white shadow-md p-6 mb-6 border border-gray-200">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-bold flex items-center gap-2 text-gray-900">
              <Store className="w-6 h-6" /> Manage Stores
            </h2>
            <button
              onClick={() => setShowAddStore(!showAddStore)}
              className="bg-green-600 text-white px-5 py-2.5 hover:bg-green-700 flex items-center gap-2 transition-colors font-medium"
            >
              <Plus className="w-4 h-4" /> Add New Store
            </button>
          </div>

          {showAddStore && (
            <div className="bg-blue-50 p-5 mb-5 border border-blue-200">
              <h3 className="font-semibold mb-4 text-blue-900 text-lg">Add New Shopify Store</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Store Name (e.g., Gymshark)"
                  value={newStoreName}
                  onChange={(e) => setNewStoreName(e.target.value)}
                  className="px-4 py-3 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
                <input
                  type="url"
                  placeholder="Store URL (e.g., https://www.gymshark.com)"
                  value={newStoreUrl}
                  onChange={(e) => setNewStoreUrl(e.target.value)}
                  className="px-4 py-3 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={addStore}
                  className="bg-blue-600 text-white px-6 py-2.5 hover:bg-blue-700 transition-colors flex items-center gap-2 font-medium"
                >
                  <Check className="w-4 h-4" /> Add Store
                </button>
                <button
                  onClick={() => setShowAddStore(false)}
                  className="bg-gray-200 text-gray-700 px-5 py-2.5 hover:bg-gray-300 transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stores.map((store, index) => (
              <div
                key={index}
                className={`p-5 border-2 transition-all cursor-pointer ${
                  currentStore.url === store.url
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-400 hover:bg-gray-50'
                }`}
                onClick={() => switchStore(store)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Store className="w-4 h-4 text-blue-600" />
                      <h3 className="font-bold text-gray-900">{store.name}</h3>
                    </div>
                    <p className="text-xs text-gray-600 break-all mb-3">{store.url}</p>
                    {currentStore.url === store.url && (
                      <span className="inline-block text-xs bg-blue-600 text-white px-3 py-1 font-medium">
                        Active Store
                      </span>
                    )}
                  </div>
                  {stores.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteStore(index);
                      }}
                      className="text-red-600 hover:text-red-800 p-1.5 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Statistics Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-blue-600 text-white p-6 shadow-md border border-blue-700">
            <Package className="w-8 h-8 mb-3 opacity-90" />
            <div className="text-3xl font-bold mb-1">{stats.totalProducts}</div>
            <div className="text-blue-100 text-sm font-medium">Total Products</div>
          </div>
          
          <div className="bg-purple-600 text-white p-6 shadow-md border border-purple-700">
            <Grid className="w-8 h-8 mb-3 opacity-90" />
            <div className="text-3xl font-bold mb-1">{selectedProducts.size}</div>
            <div className="text-purple-100 text-sm font-medium">Selected Items</div>
          </div>
          
          <div className="bg-green-600 text-white p-6 shadow-md border border-green-700">
            <DollarSign className="w-8 h-8 mb-3 opacity-90" />
            <div className="text-3xl font-bold mb-1">${stats.avgPrice}</div>
            <div className="text-green-100 text-sm font-medium">Average Price</div>
          </div>
          
          <div className="bg-teal-600 text-white p-6 shadow-md border border-teal-700">
            <CheckCircle className="w-8 h-8 mb-3 opacity-90" />
            <div className="text-3xl font-bold mb-1">{stats.inStock}</div>
            <div className="text-teal-100 text-sm font-medium">In Stock</div>
          </div>
          
          <div className="bg-red-600 text-white p-6 shadow-md border border-red-700">
            <XCircle className="w-8 h-8 mb-3 opacity-90" />
            <div className="text-3xl font-bold mb-1">{stats.outOfStock}</div>
            <div className="text-red-100 text-sm font-medium">Out of Stock</div>
          </div>
        </div>

        {/* Collection Selector */}
        <div className="bg-white shadow-md p-6 mb-6 border border-gray-200">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-900">
            <Grid className="w-6 h-6" /> Select Collection from {currentStore.name}
          </h2>
          
          <select
            value={selectedCollection}
            onChange={(e) => handleCollectionSelect(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
            disabled={loading || collections.length === 0}
          >
            <option value="">Choose a collection to Fetch</option>
            {collections.map(c => (
              <option key={c.id} value={c.handle}>
                {c.title} {c.products_count !== undefined ? `(${c.products_count} products)` : ''}
              </option>
            ))}
          </select>
          
          {collections.length === 0 && !loading && (
            <div className="mt-4 bg-yellow-50 border-2 border-yellow-300 p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-700" />
              <span className="text-yellow-800 font-medium">No collections found. This might not be a Shopify store or collections are not accessible.</span>
            </div>
          )}
          
          {scrapingAll && (
            <div className="mt-4 bg-blue-50 border-2 border-blue-300 p-4 flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-blue-700" />
              <span className="text-blue-800 font-semibold">Fetching all products from this collection. Please wait...</span>
            </div>
          )}
        </div>

        {/* Selection Controls */}
        {selectedCollection && allProducts.length > 0 && (
          <div className="bg-blue-600 shadow-md p-6 mb-6 text-white border border-blue-700">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold mb-1">Selection Controls</h3>
                <p className="text-blue-100 text-sm">{selectedProducts.size} products currently selected</p>
              </div>
              
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={selectAllOnPage}
                  className="bg-white text-blue-600 px-5 py-2.5 hover:bg-blue-50 transition-colors font-semibold flex items-center gap-2"
                >
                  <Check className="w-4 h-4" /> Select This Page ({paginatedProducts.length})
                </button>
                
                <button
                  onClick={selectAllFiltered}
                  className="bg-white text-blue-600 px-5 py-2.5 hover:bg-blue-50 transition-colors font-semibold flex items-center gap-2"
                >
                  <Check className="w-4 h-4" /> Select All Filtered ({filteredProducts.length})
                </button>
                
                <button
                  onClick={deselectAll}
                  className="bg-white text-red-600 px-5 py-2.5 hover:bg-red-50 transition-colors font-semibold flex items-center gap-2"
                >
                  <XCircle className="w-4 h-4" /> Deselect All
                </button>
                
                <button
                  onClick={uploadSelectedToDatabase}
                  disabled={selectedProducts.size === 0 || uploadingToDb}
                  className="bg-green-600 text-white px-6 py-2.5 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-bold flex items-center gap-2 shadow-md"
                >
                  <Database className="w-5 h-5" /> 
                  {uploadingToDb ? 'Uploading...' : `Upload Selected (${selectedProducts.size})`}
                </button>
              </div>
            </div>
            
            {uploadingToDb && (
              <div className="mt-5 bg-white p-4">
                <div className="flex justify-between text-sm text-gray-700 mb-2 font-medium">
                  <span>Uploading products to database...</span>
                  <span>{uploadProgress.current} / {uploadProgress.total}</span>
                </div>
                <div className="w-full bg-gray-200 h-3 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-green-600 to-blue-600 h-full transition-all duration-300"
                    style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs text-gray-600 mt-3 font-medium">
                  <span className="text-green-700">Success: {uploadResults.success}</span>
                  <span className="text-yellow-700">Skipped: {uploadResults.skipped}</span>
                  <span className="text-red-700">Failed: {uploadResults.failed}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Filters Section */}
        {selectedCollection && allProducts.length > 0 && (
          <div className="bg-white shadow-md p-6 mb-6 border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2 text-gray-900">
                <SlidersHorizontal className="w-6 h-6" /> Filter Products
              </h2>
              <button
                onClick={resetFilters}
                className="text-sm bg-gray-200 hover:bg-gray-300 px-5 py-2 transition-colors font-medium"
              >
                Reset Filters
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-2">
                <label className="block text-sm font-semibold text-gray-800 mb-2">Search Products</label>
                <input
                  type="text"
                  value={filters.searchQuery}
                  onChange={(e) => setFilters({...filters, searchQuery: e.target.value})}
                  placeholder="Search by title, vendor, or type..."
                  className="w-full px-4 py-2.5 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">Vendor</label>
                <select
                  value={filters.vendor}
                  onChange={(e) => setFilters({...filters, vendor: e.target.value})}
                  className="w-full px-4 py-2.5 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="">All Vendors</option>
                  {vendors.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">Product Type</label>
                <select
                  value={filters.productType}
                  onChange={(e) => setFilters({...filters, productType: e.target.value})}
                  className="w-full px-4 py-2.5 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="">All Types</option>
                  {productTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">Filter by Tag</label>
                <select
                  value={filters.tag}
                  onChange={(e) => setFilters({...filters, tag: e.target.value})}
                  className="w-full px-4 py-2.5 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="">All Tags</option>
                  {tags.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">Minimum Price</label>
                <input
                  type="number"
                  value={filters.priceMin}
                  onChange={(e) => setFilters({...filters, priceMin: e.target.value})}
                  placeholder="0.00"
                  className="w-full px-4 py-2.5 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">Maximum Price</label>
                <input
                  type="number"
                  value={filters.priceMax}
                  onChange={(e) => setFilters({...filters, priceMax: e.target.value})}
                  placeholder="9999.99"
                  className="w-full px-4 py-2.5 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">Availability Status</label>
                <select
                  value={filters.availability}
                  onChange={(e) => setFilters({...filters, availability: e.target.value})}
                  className="w-full px-4 py-2.5 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="all">All Products</option>
                  <option value="in-stock">In Stock Only</option>
                  <option value="out-of-stock">Out of Stock Only</option>
                </select>
              </div>
            </div>
            
            <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-5">
              <div className="text-sm text-gray-700 font-medium">
                Showing {paginatedProducts.length} of {filteredProducts.length} products
              </div>
              <div className="flex gap-3">
                <button
                  onClick={exportToJSON}
                  className="bg-blue-600 text-white px-5 py-2.5 hover:bg-blue-700 flex items-center gap-2 transition-colors font-medium"
                >
                  <Download className="w-4 h-4" /> Export JSON
                </button>
                <button
                  onClick={exportToCSV}
                  className="bg-green-600 text-white px-5 py-2.5 hover:bg-green-700 flex items-center gap-2 transition-colors font-medium"
                >
                  <Download className="w-4 h-4" /> Export CSV
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border-2 border-red-300 p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-700 mt-0.5 flex-shrink-0" />
            <div className="text-red-800 font-medium">{error}</div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="bg-white shadow-md p-16 text-center border border-gray-200">
            <Loader2 className="w-16 h-16 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-700 text-lg font-medium">Loading products from {currentStore.name}...</p>
          </div>
        )}

        {/* Products Grid */}
        {!loading && paginatedProducts.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mb-6">
              {paginatedProducts.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-white shadow-md p-6 flex items-center justify-between border border-gray-200">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-6 py-3 bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-semibold"
                >
                  Previous
                </button>
                
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 font-medium">Page</span>
                  <span className="font-bold text-blue-600 text-xl">{currentPage}</span>
                  <span className="text-gray-600 font-medium">of {totalPages}</span>
                </div>
                
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-6 py-3 bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-semibold"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}

        {/* Empty State */}
        {!loading && !selectedCollection && (
          <div className="bg-white shadow-md p-16 text-center border border-gray-200">
            <div className="bg-blue-100 w-24 h-24 flex items-center justify-center mx-auto mb-6">
              <Globe className="w-12 h-12 text-blue-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">Universal Shopify Fetcher</h3>
            <p className="text-gray-600 mb-8">Add any Shopify store and start Fetching products with ease</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-3xl mx-auto text-left">
              <div className="bg-blue-50 p-5 border border-blue-200">
                <h4 className="font-bold text-blue-900 mb-2 text-base">Add Stores</h4>
                <p className="text-sm text-blue-700">Add unlimited Shopify stores dynamically to your collection</p>
              </div>
              <div className="bg-green-50 p-5 border border-green-200">
                <h4 className="font-bold text-green-900 mb-2 text-base">Fetch Products</h4>
                <p className="text-sm text-green-700">Automatically fetch all products from any collection</p>
              </div>
              <div className="bg-purple-50 p-5 border border-purple-200">
                <h4 className="font-bold text-purple-900 mb-2 text-base">Save to Database</h4>
                <p className="text-sm text-purple-700">Upload products to Supabase with one click</p>
              </div>
            </div>
          </div>
        )}

        {!loading && selectedCollection && filteredProducts.length === 0 && (
          <div className="bg-white shadow-md p-16 text-center border border-gray-200">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-700 mb-2">No Products Found</h3>
            <p className="text-gray-600">Try adjusting your filters or select a different collection from the store</p>
          </div>
        )}
      </div>

      {/* Quick View Modal */}
      <QuickViewModal />

      {/* Image Gallery Modal */}
      {showImageModal && selectedProductImages && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4"
          onClick={() => setShowImageModal(false)}
        >
          <div 
            className="bg-white max-w-5xl w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-300 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">{selectedProductImages.title}</h3>
                <p className="text-gray-600 text-sm mt-1 font-medium">{selectedProductImages.images?.length || 0} images available</p>
              </div>
              <button
                onClick={() => setShowImageModal(false)}
                className="text-gray-600 hover:text-gray-900 p-2 hover:bg-gray-100 transition-colors"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {selectedProductImages.images?.map((img, index) => (
                <div key={index} className="relative group">
                  <img 
                    src={img.src} 
                    alt={img.alt || `${selectedProductImages.title} - Image ${index + 1}`}
                    className="w-full h-64 object-cover shadow-md"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center">
                    <a
                      href={img.src}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="opacity-0 group-hover:opacity-100 bg-white text-gray-900 px-5 py-2.5 shadow-lg hover:bg-gray-100 transition-all flex items-center gap-2 font-medium"
                    >
                      <Maximize2 className="w-4 h-4" /> View Full Size
                    </a>
                  </div>
                  <div className="absolute bottom-3 right-3 bg-black bg-opacity-80 text-white text-xs px-2.5 py-1 font-medium">
                    {img.width} × {img.height}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}