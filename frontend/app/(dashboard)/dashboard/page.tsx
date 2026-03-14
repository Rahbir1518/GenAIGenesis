import React from 'react'
import Link from 'next/link'

const Dashboard = () => {
    return (
        <div>
            <Link href="/">
                <button style={{ padding: '10px 20px', cursor: 'pointer' }} className='bg-red-600'>
                    Home page
                </button>
            </Link>
        </div>
    )
}

export default Dashboard